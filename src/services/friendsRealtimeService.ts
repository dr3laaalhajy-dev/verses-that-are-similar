import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RoomInvitePayload {
  roomId: string;
  roomCode?: string;
  roomName: string;
  hostName: string;
  hostUsername?: string;
  hostAvatarFrame?: string | null;
  senderTarget?: string;
  senderId?: number;
  isPrivate?: boolean;
  password?: string;
  isInvite?: boolean;
  invitedUserId?: string | number;
  gameMode?: string;
  timestamp: number;
}

export interface RoomInviteResponsePayload {
  event: 'invite_ignored' | 'invite_declined' | 'invite_accepted' | 'player_left';
  roomId: string;
  friendId: number | string;
  friendName?: string;
  senderId?: number | string;
  doNotDisturb?: boolean;
  action?: string;
  timestamp: number;
}

export interface PlayerPresenceData {
  uniquePlayerId?: string | null;
  username?: string | null;
  name?: string | null;
  activeFrame?: string | null;
  onlineAt: string;
}

class FriendsRealtimeService {
  private presenceChannel: RealtimeChannel | null = null;
  private inviteChannels: Map<string, RealtimeChannel> = new Map();
  private onlineIdentities: Set<string> = new Set();
  private presenceListeners: Set<(onlineKeys: Set<string>) => void> = new Set();
  private isTracking = false;
  // Callback registered by the current subscriber — replaced on every subscribeToInvites() call
  private inviteCallback: ((invite: RoomInvitePayload) => void) | null = null;
  private currentIdentifiers: Set<string> = new Set();
  private reconnectTimers: Map<string, any> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private watchdogTimer: any = null;

  /**
   * Cleans and sanitizes player identifiers to ensure valid Phoenix channel names without spaces.
   */
  public sanitizeIdentifier(raw: string): string {
    if (!raw) return '';
    let clean = String(raw).trim().replace(/^@+/, '').toLowerCase();
    if (!clean) return '';
    // If purely numeric (e.g. "51"), prefix with user_
    if (/^\d+$/.test(clean)) {
      clean = `user_${clean}`;
    }
    // Replace internal spaces, tabs, newlines, and special characters with underscore
    clean = clean.replace(/[\s\t\n\r/\\:#?]+/g, '_');
    return clean;
  }

  /**
   * Initializes Presence tracking for the current player.
   */
  public startPresence(player: {
    uniquePlayerId?: string | null;
    username?: string | null;
    name?: string | null;
    activeFrame?: string | null;
  }) {
    const rawKey = (player.uniquePlayerId || player.username || player.name || '').trim();
    if (!rawKey) return;

    if (this.presenceChannel) {
      try {
        supabase.removeChannel(this.presenceChannel);
      } catch (e) {
        console.warn('Error removing old presence channel:', e);
      }
    }

    const channelName = 'presence:online-players';
    this.presenceChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: rawKey
        }
      }
    });

    this.presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this.presenceChannel?.presenceState() || {};
        const onlineSet = new Set<string>();

        Object.entries(state).forEach(([key, presences]) => {
          onlineSet.add(key.toLowerCase());
          if (Array.isArray(presences)) {
            presences.forEach((p: any) => {
              if (p.uniquePlayerId) onlineSet.add(String(p.uniquePlayerId).toLowerCase());
              if (p.username) onlineSet.add(String(p.username).toLowerCase().replace(/^@+/, ''));
              if (p.name) onlineSet.add(String(p.name).toLowerCase());
            });
          }
        });

        this.onlineIdentities = onlineSet;
        this.notifyPresenceListeners();
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (Array.isArray(newPresences)) {
          newPresences.forEach((p: any) => {
            if (p.uniquePlayerId) this.onlineIdentities.add(String(p.uniquePlayerId).toLowerCase());
            if (p.username) this.onlineIdentities.add(String(p.username).toLowerCase().replace(/^@+/, ''));
            if (p.name) this.onlineIdentities.add(String(p.name).toLowerCase());
          });
          this.notifyPresenceListeners();
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (Array.isArray(leftPresences)) {
          leftPresences.forEach((p: any) => {
            if (p.uniquePlayerId) this.onlineIdentities.delete(String(p.uniquePlayerId).toLowerCase());
            if (p.username) this.onlineIdentities.delete(String(p.username).toLowerCase().replace(/^@+/, ''));
            if (p.name) this.onlineIdentities.delete(String(p.name).toLowerCase());
          });
          this.notifyPresenceListeners();
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.isTracking = true;
          await this.presenceChannel?.track({
            uniquePlayerId: player.uniquePlayerId,
            username: player.username,
            name: player.name,
            activeFrame: player.activeFrame,
            onlineAt: new Date().toISOString()
          });
        }
      });
  }

  /**
   * Stop presence tracking
   */
  public stopPresence() {
    if (this.presenceChannel) {
      try {
        if (this.isTracking) {
          this.presenceChannel.untrack();
        }
        supabase.removeChannel(this.presenceChannel);
      } catch (e) {
        console.warn('Error removing presence channel:', e);
      }
      this.presenceChannel = null;
      this.isTracking = false;
    }
  }

  /**
   * Check if a player is currently online
   */
  public isPlayerOnline(player: { uniquePlayerId?: string | null; username?: string | null; name?: string | null }): boolean {
    if (!player) return false;
    if (player.uniquePlayerId && this.onlineIdentities.has(player.uniquePlayerId.toLowerCase())) return true;
    if (player.username && this.onlineIdentities.has(player.username.toLowerCase().replace(/^@+/, ''))) return true;
    if (player.name && this.onlineIdentities.has(player.name.toLowerCase())) return true;
    return false;
  }

  /**
   * Listen to presence updates
   */
  public onPresenceChange(listener: (onlineKeys: Set<string>) => void): () => void {
    this.presenceListeners.add(listener);
    listener(this.onlineIdentities);
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  private notifyPresenceListeners() {
    this.presenceListeners.forEach(listener => {
      try {
        listener(this.onlineIdentities);
      } catch (e) {
        console.error('Error in presence listener:', e);
      }
    });
  }

  /**
   * Listen for incoming room invites for current user
   */
  /**
   * Listen for incoming room invites for current user.
   *
   * Channels are persistent singletons keyed by identifier with auto-reconnect
   * watchdog, ensuring invites are NEVER dropped on room unmounts or kicks.
   */
  public subscribeToInvites(
    identifiers: string[],
    onInviteReceived: (invite: RoomInvitePayload) => void
  ): () => void {
    // Store the latest callback so existing channels always call the fresh one
    this.inviteCallback = onInviteReceived;

    identifiers.forEach(raw => {
      const clean = this.sanitizeIdentifier(raw);
      if (!clean) return;
      this.currentIdentifiers.add(clean);
      this.ensureInviteChannel(clean);
    });

    // Start auto-reconnect watchdog if not active
    if (!this.watchdogTimer && typeof window !== 'undefined') {
      this.watchdogTimer = setInterval(() => {
        this.currentIdentifiers.forEach(clean => {
          const ch = this.inviteChannels.get(clean);
          if (!ch || ch.state === 'closed' || ch.state === 'errored') {
            console.log(`[FriendsRealtime Watchdog] Auto-reconnecting invite channel for "${clean}"`);
            this.ensureInviteChannel(clean);
          }
        });
      }, 10000);
    }

    // Return a "unsubscribe" function that only clears the callback when no other subscriber exists
    return () => {
      if (this.inviteCallback === onInviteReceived) {
        // Keep channels alive for global root listener
      }
    };
  }

  /**
   * Ensures an active, healthy invite channel exists for an identifier.
   */
  private ensureInviteChannel(rawClean: string) {
    const clean = this.sanitizeIdentifier(rawClean);
    if (!clean) return;

    if (this.reconnectTimers.has(clean)) {
      clearTimeout(this.reconnectTimers.get(clean));
      this.reconnectTimers.delete(clean);
    }

    const channelName = `player-invites:${clean}`;
    let channel = this.inviteChannels.get(clean);

    // If channel is already joined OR currently joining, do not disrupt it!
    if (channel && (channel.state === 'joined' || channel.state === 'joining')) {
      return;
    }

    if (channel) {
      try { supabase.removeChannel(channel); } catch (_) {}
      this.inviteChannels.delete(clean);
    }

    channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'room-invite' }, ({ payload }) => {
        if (payload && payload.roomId && this.inviteCallback) {
          this.inviteCallback(payload as RoomInvitePayload);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.inviteChannels.set(clean, channel!);
          this.failureCounts.set(clean, 0); // reset failure count on success
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.inviteChannels.delete(clean);
          const currentFailures = (this.failureCounts.get(clean) || 0) + 1;
          this.failureCounts.set(clean, currentFailures);

          // Exponential / backed-off retry: if repeated failures (>4), wait 30s instead of rapid loop
          const retryDelay = currentFailures > 4 ? 30000 : 2500;

          console.warn(`[FriendsRealtime] Invite channel for "${clean}" entered ${status} (attempt ${currentFailures}), auto-reconnecting in ${retryDelay / 1000}s...`);
          if (this.currentIdentifiers.has(clean)) {
            const timer = setTimeout(() => {
              this.ensureInviteChannel(clean);
            }, retryDelay);
            this.reconnectTimers.set(clean, timer);
          }
        }
      });

    this.inviteChannels.set(clean, channel);
  }

  /**
   * Tear down ALL invite channels (call only on full app logout/unmount).
   */
  public removeAllInviteChannels() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.reconnectTimers.forEach(t => clearTimeout(t));
    this.reconnectTimers.clear();
    this.currentIdentifiers.clear();
    this.failureCounts.clear();

    this.inviteChannels.forEach(ch => {
      try { supabase.removeChannel(ch); } catch (_) {}
    });
    this.inviteChannels.clear();
    this.inviteCallback = null;
  }

  /**
   * Send a game invite to a specific friend
   */
  public async sendRoomInvite(
    targetIdentifier: string,
    payload: RoomInvitePayload
  ): Promise<boolean> {
    const clean = this.sanitizeIdentifier(targetIdentifier);
    if (!clean) return false;

    const channelName = `player-invites:${clean}`;
    const channel = supabase.channel(channelName);

    // Requirement 3: Insert single notification row strictly with receiver_id containing ONLY recipient's ID
    const recipientId = String(payload.invitedUserId || clean.replace(/^user_/, '')).trim();
    if (recipientId) {
      const isUuid = typeof recipientId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recipientId);

      const notificationRow: any = {
        receiver_id: recipientId,
        title: `دعوة تحدي من ${payload.hostName || 'صديق'}`,
        body: `أرسل لك دعوة للانضمام إلى: ${payload.roomName || 'غرفة التحدي'}`,
        is_read: false
      };
      if (isUuid) {
        notificationRow.user_id = recipientId;
      }

      Promise.resolve(
        supabase.from('notifications').insert(notificationRow)
      ).catch((err) => {
        // Safe fallback if receiver_id column is not yet present on table
        if (err?.message?.includes('receiver_id') && isUuid) {
          Promise.resolve(
            supabase.from('notifications').insert({
              user_id: recipientId,
              title: notificationRow.title,
              body: notificationRow.body,
              is_read: false
            })
          ).catch(() => {});
        }
      });
    }

    return new Promise<boolean>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'room-invite',
            payload
          }).then(() => {
            setTimeout(() => {
              // Crucial fix: NEVER remove channel if this client is also listening to it!
              if (!this.inviteChannels.has(clean)) {
                try {
                  supabase.removeChannel(channel);
                } catch (e) { }
              }
              resolve(true);
            }, 300);
          }).catch(err => {
            console.error('Failed to send broadcast room invite:', err);
            if (!this.inviteChannels.has(clean)) {
              try {
                supabase.removeChannel(channel);
              } catch (e) { }
            }
            resolve(false);
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (!this.inviteChannels.has(clean)) {
            try {
              supabase.removeChannel(channel);
            } catch (e) { }
          }
          resolve(false);
        }
      });
    });
  }

  /**
   * Send response to an invite back to the host/sender:
   * event: 'invite_ignored' | 'invite_declined' | 'invite_accepted' | 'player_left'
   */
  public async sendInviteResponse(
    senderTarget: string,
    event: 'invite_ignored' | 'invite_declined' | 'invite_accepted' | 'player_left',
    payload: {
      roomId: string;
      friendId: number | string;
      friendName?: string;
      senderId?: number | string;
      doNotDisturb?: boolean;
      action?: string;
      timestamp?: number;
    }
  ): Promise<boolean> {
    const clean = String(senderTarget || '').trim().replace(/^@+/, '').toLowerCase();
    if (!clean) return false;

    const channelName = `player-invites:${clean}`;
    const channel = supabase.channel(channelName);

    return new Promise<boolean>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          const finalPayload: RoomInviteResponsePayload = {
            ...payload,
            event,
            timestamp: payload.timestamp || Date.now()
          };

          Promise.allSettled([
            channel.send({
              type: 'broadcast',
              event,
              payload: finalPayload
            }),
            channel.send({
              type: 'broadcast',
              event: 'room-invite-response',
              payload: finalPayload
            })
          ]).then(() => {
            setTimeout(() => {
              try {
                supabase.removeChannel(channel);
              } catch (e) { }
              resolve(true);
            }, 300);
          }).catch(err => {
            console.error('Failed to send invite response broadcast:', err);
            try {
              supabase.removeChannel(channel);
            } catch (e) { }
            resolve(false);
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve(false);
        }
      });
    });
  }

  /**
   * Subscribe to invite response events from invited friends (ignored, declined, accepted)
   */
  public subscribeToInviteResponses(
    identifiers: string[],
    onResponseReceived: (res: RoomInviteResponsePayload) => void
  ): () => void {
    const activeSubs: RealtimeChannel[] = [];

    identifiers.forEach(raw => {
      const clean = String(raw || '').trim().replace(/^@+/, '').toLowerCase();
      if (!clean) return;

      const channelName = `player-invites:${clean}`;
      const channel = supabase.channel(channelName);

      channel
        .on('broadcast', { event: 'invite_ignored' }, ({ payload }) => {
          if (payload) onResponseReceived({ ...(payload as RoomInviteResponsePayload), event: 'invite_ignored' });
        })
        .on('broadcast', { event: 'invite_declined' }, ({ payload }) => {
          if (payload) onResponseReceived({ ...(payload as RoomInviteResponsePayload), event: 'invite_declined' });
        })
        .on('broadcast', { event: 'invite_accepted' }, ({ payload }) => {
          if (payload) onResponseReceived({ ...(payload as RoomInviteResponsePayload), event: 'invite_accepted' });
        })
        .on('broadcast', { event: 'player_left' }, ({ payload }) => {
          if (payload) onResponseReceived({ ...(payload as RoomInviteResponsePayload), event: 'player_left' });
        })
        .on('broadcast', { event: 'participant_removed' }, ({ payload }) => {
          if (payload) onResponseReceived({ ...(payload as RoomInviteResponsePayload), event: 'player_left' });
        })
        .on('broadcast', { event: 'room-invite-response' }, ({ payload }) => {
          if (payload && (payload as any).event) {
            onResponseReceived(payload as RoomInviteResponsePayload);
          }
        })
        .subscribe();

      activeSubs.push(channel);
    });

    return () => {
      activeSubs.forEach(ch => {
        try {
          supabase.removeChannel(ch);
        } catch (e) { }
      });
    };
  }
}

export const friendsRealtimeService = new FriendsRealtimeService();
export default friendsRealtimeService;


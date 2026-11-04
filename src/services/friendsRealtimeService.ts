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
  event: 'invite_ignored' | 'invite_declined' | 'invite_accepted';
  roomId: string;
  friendId: number | string;
  friendName?: string;
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
  public subscribeToInvites(
    identifiers: string[],
    onInviteReceived: (invite: RoomInvitePayload) => void
  ): () => void {
    const activeSubs: RealtimeChannel[] = [];

    identifiers.forEach(raw => {
      const clean = String(raw || '').trim().replace(/^@+/, '').toLowerCase();
      if (!clean) return;

      const channelName = `player-invites:${clean}`;
      const channel = supabase.channel(channelName);

      channel
        .on('broadcast', { event: 'room-invite' }, ({ payload }) => {
          if (payload && payload.roomId) {
            onInviteReceived(payload as RoomInvitePayload);
          }
        })
        .subscribe();

      activeSubs.push(channel);
    });

    return () => {
      activeSubs.forEach(ch => {
        try {
          supabase.removeChannel(ch);
        } catch (e) {
          console.warn('Error removing invite channel:', e);
        }
      });
    };
  }

  /**
   * Send a game invite to a specific friend
   */
  public async sendRoomInvite(
    targetIdentifier: string,
    payload: RoomInvitePayload
  ): Promise<boolean> {
    const clean = String(targetIdentifier || '').trim().replace(/^@+/, '').toLowerCase();
    if (!clean) return false;

    const channelName = `player-invites:${clean}`;
    const channel = supabase.channel(channelName);

    return new Promise<boolean>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'room-invite',
            payload
          }).then(() => {
            setTimeout(() => {
              try {
                supabase.removeChannel(channel);
              } catch (e) {}
              resolve(true);
            }, 300);
          }).catch(err => {
            console.error('Failed to send broadcast room invite:', err);
            try {
              supabase.removeChannel(channel);
            } catch (e) {}
            resolve(false);
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve(false);
        }
      });
    });
  }

  /**
   * Send response to an invite back to the host/sender:
   * event: 'invite_ignored' | 'invite_declined' | 'invite_accepted'
   */
  public async sendInviteResponse(
    senderTarget: string,
    event: 'invite_ignored' | 'invite_declined' | 'invite_accepted',
    payload: {
      roomId: string;
      friendId: number | string;
      friendName?: string;
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
              } catch (e) {}
              resolve(true);
            }, 300);
          }).catch(err => {
            console.error('Failed to send invite response broadcast:', err);
            try {
              supabase.removeChannel(channel);
            } catch (e) {}
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
        } catch (e) {}
      });
    };
  }
}

export const friendsRealtimeService = new FriendsRealtimeService();
export default friendsRealtimeService;


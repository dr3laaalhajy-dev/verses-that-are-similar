/**
 * The app's room setter: React state + a ref that always holds the room OBJECT on screen (used to
 * ignore late answers for another room), + the remembered active room id.
 *
 * Pages also call setRoom(prev => next). Storing that function in the ref (the old wrapper did)
 * left roomRef.current without an id, so every later room answer looked "not current" and was
 * dropped: the waiting room never started and results never showed until a refresh.
 */
export function createRoomSetter(
  setState: (updater: any) => void,
  ref: { current: any },
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null
) {
  const remember = (val: any) => {
    try {
      if (val && val.id) storage?.setItem('activeRoomId', String(val.id));
      else if (!val) storage?.removeItem('activeRoomId');
    } catch {
      // storage unavailable: nothing to remember
    }
  };
  return (val: any) => {
    if (typeof val === 'function') {
      // Resolve against the latest room right away, so the ref is correct before React renders.
      const next = val(ref.current);
      ref.current = next;
      setState(next);
      remember(next);
      return;
    }
    ref.current = val;
    setState(val);
    remember(val);
  };
}

/** A room answer that arrived after a wait belongs to the room still on screen. */
export function isCurrentRoom(ref: { current: any }, data: any): boolean {
  return Boolean(data?.id) && String(data.id) === String(ref.current?.id ?? '');
}

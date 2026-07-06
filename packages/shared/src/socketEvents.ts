export const SOCKET_EVENTS = {
  // Connection
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',

  // Matchmaking
  JOIN_QUEUE: 'matchmaking:join',
  LEAVE_QUEUE: 'matchmaking:leave',
  QUEUE_UPDATE: 'matchmaking:update',
  MATCH_FOUND: 'matchmaking:found',

  // Game Room Lifecycle
  JOIN_ROOM: 'room:join',
  ROOM_STATE: 'room:state',
  TIMER_TICK: 'room:timer',
  SIGNAL_UPDATE: 'room:signal',

  // Chat
  SEND_MESSAGE: 'chat:send',
  RECEIVE_MESSAGE: 'chat:receive',

  // Choice phase
  SELECT_TENTATIVE: 'game:select_tentative',
  SUBMIT_CHOICE: 'game:submit_choice',
  CHOICE_LOCKED: 'game:choice_locked',
  MATCH_RESULT: 'game:result',

  // Rematch / Error
  REMATCH_REQUEST: 'game:rematch_request',
  ERROR: 'game:error'
} as const;

export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

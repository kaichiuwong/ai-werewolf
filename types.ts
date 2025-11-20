export enum Role {
  WEREWOLF = 'WEREWOLF',
  VILLAGER = 'VILLAGER',
  SEER = 'SEER',
  WITCH = 'WITCH',
  HUNTER = 'HUNTER'
}

export enum GamePhase {
  SETUP = 'SETUP',
  NIGHT_START = 'NIGHT_START',
  NIGHT_WEREWOLF = 'NIGHT_WEREWOLF',
  NIGHT_SEER = 'NIGHT_SEER',
  NIGHT_WITCH = 'NIGHT_WITCH',
  NIGHT_END = 'NIGHT_END',
  DAY_ANNOUNCE = 'DAY_ANNOUNCE',
  DAY_DISCUSS = 'DAY_DISCUSS',
  DAY_VOTE = 'DAY_VOTE',
  DAY_EXECUTE = 'DAY_EXECUTE',
  GAME_OVER = 'GAME_OVER'
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  isBot: boolean;
  isAlive: boolean;
  isDying: boolean; // Marked for death this night
  isProtected: boolean; // Protected by Witch
  isPoisoned: boolean; // Poisoned by Witch
  hasActed: boolean; // For current phase
  voteTargetId: string | null; // Who they voted for
  avatarUrl: string;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  humanPlayerId: string | null; // Assuming single player vs bots for this web app context
  dayCount: number;
  logs: LogMessage[];
  winner: 'WEREWOLF' | 'VILLAGER' | null;
  witchPotions: {
    save: boolean;
    poison: boolean;
  };
  lastKilledId: string | null; // For Witch info
  seerCheckResult: { name: string; isWerewolf: boolean } | null;
}

export interface LogMessage {
  id: string;
  sender: 'HOST' | 'SYSTEM' | string; // Name of player or HOST/SYSTEM
  text: string;
  type: 'normal' | 'narrative' | 'action' | 'alert';
}

export interface RoleConfig {
  name: string;
  description: string;
  icon: string;
  team: 'GOOD' | 'BAD';
}
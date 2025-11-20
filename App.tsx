
import React, { useState, useEffect, useReducer, useRef } from 'react';
import { 
  GamePhase, 
  Role, 
  Player, 
  GameState, 
  LogMessage 
} from './types';
import { 
  ROLE_DETAILS, 
  ROLE_GUIDES,
  getRoleDistribution, 
  generateAvatarUrl,
  BOT_NAMES
} from './constants';
import { Button, PlayerCard, LogEntry, Modal } from './components/GameComponents';
import { generateHostNarration, generateBotDiscussion, generateBotResponseToUser } from './services/geminiService';
import { playVoteSound, playDeathSound } from './services/soundService';
import { Activity, Users, Moon, Sun, RotateCcw, RefreshCw, BookOpen, Send, Trophy, Skull } from 'lucide-react';

// --- Reducer for Game State ---

const initialState: GameState = {
  phase: GamePhase.SETUP,
  players: [],
  humanPlayerId: null,
  dayCount: 0,
  logs: [],
  winner: null,
  witchPotions: { save: true, poison: true },
  lastKilledId: null,
  seerCheckResult: null,
};

type Action = 
  | { type: 'START_GAME'; players: Player[]; humanId: string }
  | { type: 'NEXT_PHASE'; phase: GamePhase }
  | { type: 'ADD_LOG'; message: LogMessage }
  | { type: 'UPDATE_PLAYER'; playerId: string; updates: Partial<Player> }
  | { type: 'SET_WITCH_POTION'; potion: 'save' | 'poison'; used: boolean }
  | { type: 'SET_LAST_KILLED'; playerId: string | null }
  | { type: 'SET_SEER_RESULT'; result: { name: string; isWerewolf: boolean } | null }
  | { type: 'SET_WINNER'; winner: 'WEREWOLF' | 'VILLAGER' }
  | { type: 'RESET_GAME' }
  | { type: 'INCREMENT_DAY' };

const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'START_GAME':
      return { ...initialState, phase: GamePhase.NIGHT_START, players: action.players, humanPlayerId: action.humanId, dayCount: 1 };
    case 'NEXT_PHASE':
      return { ...state, phase: action.phase };
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, action.message] };
    case 'UPDATE_PLAYER':
      return {
        ...state,
        players: state.players.map(p => p.id === action.playerId ? { ...p, ...action.updates } : p)
      };
    case 'SET_WITCH_POTION':
      return { ...state, witchPotions: { ...state.witchPotions, [action.potion]: !action.used } };
    case 'SET_LAST_KILLED':
      return { ...state, lastKilledId: action.playerId };
    case 'SET_SEER_RESULT':
      return { ...state, seerCheckResult: action.result };
    case 'SET_WINNER':
      return { ...state, winner: action.winner };
    case 'INCREMENT_DAY':
      return { ...state, dayCount: state.dayCount + 1 };
    case 'RESET_GAME':
      return initialState;
    default:
      return state;
  }
};

// --- Main Component ---

const App: React.FC = () => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [setupName, setSetupName] = useState('');
  const [setupCount, setSetupCount] = useState(6);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  
  // Avatar Selection State
  const [avatarOptions, setAvatarOptions] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');

  // Help Modal State
  const [showHelp, setShowHelp] = useState(false);
  const [viewingHelpRole, setViewingHelpRole] = useState<Role>(Role.VILLAGER);
  
  // Game Over Result Modal State
  const [showResultModal, setShowResultModal] = useState(false);

  // Chat Input State
  const [chatMessage, setChatMessage] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Determine Theme: Setup and Night Phases are "Night" (Dark Mode), Day Phases are "Day" (Light Mode)
  const isNight = state.phase === GamePhase.SETUP || state.phase.includes('NIGHT');

  // Generate avatar options on mount
  useEffect(() => {
    regenerateAvatarOptions();
  }, []);

  const regenerateAvatarOptions = () => {
    const options = Array.from({ length: 8 }).map(() => 
      generateAvatarUrl(Math.random().toString(36).substring(7))
    );
    setAvatarOptions(options);
    setSelectedAvatar(options[0]);
  };

  // Sync viewing role with human role when game starts
  useEffect(() => {
    const human = state.players.find(p => p.id === state.humanPlayerId);
    if (human) {
      setViewingHelpRole(human.role);
    }
  }, [state.humanPlayerId, state.players]);

  // Auto scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs]);

  // Auto-focus chat input when entering discussion phase
  useEffect(() => {
    if (state.phase === GamePhase.DAY_DISCUSS) {
      // Slight delay to ensure UI is rendered
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 100);
    }
  }, [state.phase]);

  // Show Game Over Result Modal automatically
  useEffect(() => {
    if (state.phase === GamePhase.GAME_OVER) {
        setTimeout(() => {
            setShowResultModal(true);
        }, 2000);
    }
  }, [state.phase]);

  // --- Auto Discussion Logic ---
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const runAutoDiscussion = async () => {
      if (state.phase !== GamePhase.DAY_DISCUSS) return;

      // Wait a random amount of time before the next bot speaks (3s to 7s)
      const delay = 3000 + Math.random() * 4000;

      timeoutId = setTimeout(async () => {
        if (state.phase !== GamePhase.DAY_DISCUSS) return;

        const msg = await generateBotDiscussion(state.players, state.logs);
        if (msg) {
          addLog(msg.content, msg.speaker, 'normal');
        }
      }, delay);
    };

    runAutoDiscussion();

    return () => clearTimeout(timeoutId);
  }, [state.phase, state.logs, state.players]); 

  // --- Helper Functions ---

  const addLog = (text: string, sender: string = '系統', type: LogMessage['type'] = 'normal') => {
    dispatch({
      type: 'ADD_LOG',
      message: { id: Date.now().toString() + Math.random(), sender, text, type }
    });
  };

  const getHumanPlayer = () => state.players.find(p => p.id === state.humanPlayerId);

  // --- Game Logic / Phase Effects ---

  useEffect(() => {
    const runPhaseLogic = async () => {
      // Check Win Condition
      const aliveWolves = state.players.filter(p => p.isAlive && p.role === Role.WEREWOLF).length;
      const aliveGood = state.players.filter(p => p.isAlive && p.role !== Role.WEREWOLF).length;
      
      if (state.phase !== GamePhase.SETUP && state.phase !== GamePhase.GAME_OVER) {
        if (aliveWolves === 0) {
          dispatch({ type: 'SET_WINNER', winner: 'VILLAGER' });
          dispatch({ type: 'NEXT_PHASE', phase: GamePhase.GAME_OVER });
          addLog("狼人全滅，好人勝利！", "系統", "alert");
          const narrative = await generateHostNarration(GamePhase.GAME_OVER, state.dayCount, state.players);
          addLog(narrative, "HOST", "narrative");
          return;
        }
        if (aliveWolves >= aliveGood) {
          dispatch({ type: 'SET_WINNER', winner: 'WEREWOLF' });
          dispatch({ type: 'NEXT_PHASE', phase: GamePhase.GAME_OVER });
          addLog("狼人數量大於等於好人，狼人勝利！", "系統", "alert");
           const narrative = await generateHostNarration(GamePhase.GAME_OVER, state.dayCount, state.players);
          addLog(narrative, "HOST", "narrative");
          return;
        }
      }

      // Phase Transitions
      switch (state.phase) {
        case GamePhase.NIGHT_START: {
          // Reset nightly flags
          state.players.forEach(p => {
             dispatch({ type: 'UPDATE_PLAYER', playerId: p.id, updates: { isDying: false, isProtected: false, isPoisoned: false, voteTargetId: null } });
          });
          dispatch({ type: 'SET_LAST_KILLED', playerId: null });
          
          const narrative = await generateHostNarration(GamePhase.NIGHT_START, state.dayCount, state.players);
          addLog(narrative, "HOST", "narrative");
          
          setTimeout(() => dispatch({ type: 'NEXT_PHASE', phase: GamePhase.NIGHT_WEREWOLF }), 3000);
          break;
        }

        case GamePhase.NIGHT_WEREWOLF: {
           addLog("狼人請睜眼，請選擇今晚的獵物。", "系統", "normal");
           const human = getHumanPlayer();
           
           // If human is not werewolf, simulate delay then proceed
           if (human?.role !== Role.WEREWOLF || !human.isAlive) {
             setTimeout(() => {
               handleBotWerewolfAction();
               dispatch({ type: 'NEXT_PHASE', phase: GamePhase.NIGHT_SEER });
             }, 3000 + Math.random() * 2000);
           }
           break;
        }

        case GamePhase.NIGHT_SEER: {
          addLog("預言家請睜眼，請選擇查驗對象。", "系統", "normal");
          const human = getHumanPlayer();
          if (human?.role !== Role.SEER || !human.isAlive) {
             setTimeout(() => {
               handleBotSeerAction();
               dispatch({ type: 'NEXT_PHASE', phase: GamePhase.NIGHT_WITCH });
             }, 2000 + Math.random() * 2000);
          }
          break;
        }

        case GamePhase.NIGHT_WITCH: {
           addLog("女巫請睜眼。", "系統", "normal");
           const human = getHumanPlayer();
           if (human?.role !== Role.WITCH || !human.isAlive) {
              setTimeout(() => {
                handleBotWitchAction();
                dispatch({ type: 'NEXT_PHASE', phase: GamePhase.NIGHT_END });
              }, 2000 + Math.random() * 2000);
           }
           break;
        }

        case GamePhase.NIGHT_END: {
           // Process deaths
           const deadNames: string[] = [];
           state.players.forEach(p => {
             if ((p.isDying && !p.isProtected) || p.isPoisoned) {
                dispatch({ type: 'UPDATE_PLAYER', playerId: p.id, updates: { isAlive: false } });
                deadNames.push(p.name);
             }
           });
           
           if (deadNames.length > 0) {
             playDeathSound();
           }

           // Update Day Count if needed or just before announce
           dispatch({ type: 'NEXT_PHASE', phase: GamePhase.DAY_ANNOUNCE });
           break;
        }

        case GamePhase.DAY_ANNOUNCE: {
           const newlyDead = state.players.filter(p => !p.isAlive && (p.isDying || p.isPoisoned)); 
           
           const narrative = await generateHostNarration(
              GamePhase.DAY_ANNOUNCE, 
              state.dayCount, 
              state.players, 
              newlyDead.map(p => p.name)
           );
           addLog(narrative, "HOST", "narrative");

           setTimeout(() => {
             dispatch({ type: 'NEXT_PHASE', phase: GamePhase.DAY_DISCUSS });
           }, 4000);
           break;
        }

        case GamePhase.DAY_DISCUSS: {
          addLog("現在開始自由討論。你可以通過聊天框與其他玩家互動。", "系統", "normal");
          break;
        }

        case GamePhase.DAY_VOTE: {
           addLog("請所有玩家進行投票。", "系統", "alert");
           handleBotVoting();

           const human = getHumanPlayer();
           if (human && !human.isAlive) {
             addLog("你已死亡，正在觀戰投票結果...", "系統");
             setTimeout(() => {
                dispatch({ type: 'NEXT_PHASE', phase: GamePhase.DAY_EXECUTE });
             }, 4000);
           }
           break;
        }
        
        case GamePhase.DAY_EXECUTE: {
            // Count votes
            const votes: Record<string, number> = {};
            state.players.filter(p => p.isAlive).forEach(p => {
                if (p.voteTargetId) {
                    votes[p.voteTargetId] = (votes[p.voteTargetId] || 0) + 1;
                }
            });

            let maxVotes = 0;
            let victimId: string | null = null;
            let tie = false;

            Object.entries(votes).forEach(([id, count]) => {
                if (count > maxVotes) {
                    maxVotes = count;
                    victimId = id;
                    tie = false;
                } else if (count === maxVotes) {
                    tie = true;
                }
            });

            if (victimId && !tie) {
                const victim = state.players.find(p => p.id === victimId);
                if (victim) {
                    playDeathSound();
                    addLog(`${victim.name} 被投票處決了。`, "系統", "alert");
                    dispatch({ type: 'UPDATE_PLAYER', playerId: victim.id, updates: { isAlive: false } });
                }
            } else {
                addLog("票數平手，無人被處決。", "系統", "normal");
            }

            setTimeout(() => {
                dispatch({ type: 'INCREMENT_DAY' });
                dispatch({ type: 'NEXT_PHASE', phase: GamePhase.NIGHT_START });
            }, 3000);
            break;
        }
      }
    };

    runPhaseLogic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);


  // --- Action Handlers (Bots) ---

  const handleBotWerewolfAction = () => {
      const aliveGood = state.players.filter(p => p.isAlive && p.role !== Role.WEREWOLF);
      if (aliveGood.length > 0) {
          const target = aliveGood[Math.floor(Math.random() * aliveGood.length)];
          dispatch({ type: 'SET_LAST_KILLED', playerId: target.id });
          dispatch({ type: 'UPDATE_PLAYER', playerId: target.id, updates: { isDying: true } });
      }
  };

  const handleBotSeerAction = () => {
      // Bot Seer logic (hidden)
  };

  const handleBotWitchAction = () => {
      // Bot Witch logic (hidden)
  };

  const handleBotVoting = () => {
      const alive = state.players.filter(p => p.isAlive);
      alive.forEach(bot => {
          if (bot.isBot) {
              const others = alive.filter(p => p.id !== bot.id);
              if (others.length > 0) {
                 const target = others[Math.floor(Math.random() * others.length)];
                 dispatch({ type: 'UPDATE_PLAYER', playerId: bot.id, updates: { voteTargetId: target.id } });
              }
          }
      });
  };

  // --- Action Handlers (Human) ---

  const handleStartGame = () => {
    if (setupName.trim() === '') return;
    
    const roles = getRoleDistribution(setupCount);
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    const shuffledNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
    
    const newPlayers: Player[] = Array.from({ length: setupCount }).map((_, idx) => {
      const isHuman = idx === 0;
      const botName = shuffledNames[idx - 1] || `Bot ${idx}`;
      const botAvatar = generateAvatarUrl(`bot-${idx}-${Date.now()}-${Math.random()}`);

      return {
        id: `p-${idx}`,
        name: isHuman ? setupName : botName,
        role: roles[idx],
        isBot: !isHuman,
        isAlive: true,
        isDying: false,
        isProtected: false,
        isPoisoned: false,
        hasActed: false,
        voteTargetId: null,
        avatarUrl: isHuman ? selectedAvatar : botAvatar
      };
    });

    playVoteSound();
    dispatch({ type: 'START_GAME', players: newPlayers, humanId: newPlayers[0].id });
  };

  const handleHumanAction = () => {
      const human = getHumanPlayer();
      if (!human || !human.isAlive) return;
      if (!selectedTargetId && state.phase !== GamePhase.DAY_DISCUSS) return;

      playVoteSound();

      if (state.phase === GamePhase.NIGHT_WEREWOLF && human.role === Role.WEREWOLF) {
          if (selectedTargetId) {
            dispatch({ type: 'SET_LAST_KILLED', playerId: selectedTargetId });
            dispatch({ type: 'UPDATE_PLAYER', playerId: selectedTargetId, updates: { isDying: true } });
            addLog(`你襲擊了 ${state.players.find(p=>p.id===selectedTargetId)?.name}`, "系統");
            dispatch({ type: 'NEXT_PHASE', phase: GamePhase.NIGHT_SEER });
            setSelectedTargetId(null);
          }
      } 
      else if (state.phase === GamePhase.NIGHT_SEER && human.role === Role.SEER) {
          if (selectedTargetId) {
              const target = state.players.find(p => p.id === selectedTargetId);
              if (target) {
                  const isWolf = target.role === Role.WEREWOLF;
                  dispatch({ type: 'SET_SEER_RESULT', result: { name: target.name, isWerewolf: isWolf } });
                  addLog(`${target.name} 是 ${isWolf ? '狼人' : '好人'}`, "查驗結果");
              }
              setTimeout(() => {
                  dispatch({ type: 'NEXT_PHASE', phase: GamePhase.NIGHT_WITCH });
                  setSelectedTargetId(null);
              }, 2000);
          }
      }
      else if (state.phase === GamePhase.DAY_VOTE) {
          if (selectedTargetId) {
              dispatch({ type: 'UPDATE_PLAYER', playerId: human.id, updates: { voteTargetId: selectedTargetId } });
              addLog(`你投票給了 ${state.players.find(p=>p.id===selectedTargetId)?.name}`, "系統");
              dispatch({ type: 'NEXT_PHASE', phase: GamePhase.DAY_EXECUTE });
              setSelectedTargetId(null);
          }
      }
  };

  const handleWitchSave = () => {
      if (state.lastKilledId && state.witchPotions.save) {
          playVoteSound();
          dispatch({ type: 'UPDATE_PLAYER', playerId: state.lastKilledId, updates: { isDying: false, isProtected: true } });
          dispatch({ type: 'SET_WITCH_POTION', potion: 'save', used: true });
          addLog("你使用了解藥。", "系統");
      }
  };

  const handleWitchPoison = () => {
      if (selectedTargetId && state.witchPotions.poison) {
          playVoteSound();
          dispatch({ type: 'UPDATE_PLAYER', playerId: selectedTargetId, updates: { isPoisoned: true } });
          dispatch({ type: 'SET_WITCH_POTION', potion: 'poison', used: true });
          addLog("你使用了毒藥。", "系統");
          dispatch({ type: 'NEXT_PHASE', phase: GamePhase.NIGHT_END });
          setSelectedTargetId(null);
      }
  };

  const skipPhase = () => {
     playVoteSound();
     if (state.phase === GamePhase.NIGHT_WITCH) {
         dispatch({ type: 'NEXT_PHASE', phase: GamePhase.NIGHT_END });
     }
     if (state.phase === GamePhase.DAY_DISCUSS) {
         dispatch({ type: 'NEXT_PHASE', phase: GamePhase.DAY_VOTE });
     }
  };

  const handleSendChat = async () => {
    if (!chatMessage.trim() || isSendingChat) return;
    
    const human = getHumanPlayer();
    if (!human) return;

    const msgText = chatMessage.trim();
    setChatMessage('');
    setIsSendingChat(true);
    
    addLog(msgText, human.name, 'normal');

    try {
       const botResponse = await generateBotResponseToUser(
         state.players, 
         state.logs, 
         msgText, 
         human.name
       );
       if (botResponse) {
         addLog(botResponse.content, botResponse.speaker, 'normal');
       }
    } catch (error) {
       console.error("Chat error", error);
    } finally {
       setIsSendingChat(false);
       setTimeout(() => chatInputRef.current?.focus(), 0);
    }
  };

  // --- Render Helpers ---

  const human = getHumanPlayer();
  const isHumanTurn = 
    (state.phase === GamePhase.NIGHT_WEREWOLF && human?.role === Role.WEREWOLF && human.isAlive) ||
    (state.phase === GamePhase.NIGHT_SEER && human?.role === Role.SEER && human.isAlive) ||
    (state.phase === GamePhase.NIGHT_WITCH && human?.role === Role.WITCH && human.isAlive) ||
    (state.phase === GamePhase.DAY_VOTE && human?.isAlive);


  if (state.phase === GamePhase.SETUP) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-slate-200 font-serif overflow-y-auto transition-colors duration-1000">
        <div className="max-w-2xl w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 my-8">
          <div className="flex justify-center mb-6">
            <Moon className="w-16 h-16 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 text-amber-500">AI 狼人殺</h1>
          <p className="text-center text-slate-400 mb-8">由 Gemini AI 主持的懸疑推理遊戲</p>
          
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">你的名字</label>
                  <input 
                    type="text" 
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    className="w-full p-3 rounded bg-slate-700 border border-slate-600 focus:border-amber-500 focus:outline-none transition text-white"
                    placeholder="請輸入暱稱"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">玩家人數 (6-18)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="6" 
                      max="18" 
                      value={setupCount}
                      onChange={(e) => setSetupCount(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                    <span className="text-2xl font-bold w-8">{setupCount}</span>
                  </div>
                </div>
              </div>

              <div>
                 <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">選擇頭像</label>
                    <button onClick={regenerateAvatarOptions} className="text-xs flex items-center gap-1 text-amber-500 hover:text-amber-400">
                       <RefreshCw size={12} /> 換一批
                    </button>
                 </div>
                 <div className="grid grid-cols-4 gap-2">
                    {avatarOptions.map((url) => (
                       <div 
                          key={url} 
                          onClick={() => {
                              setSelectedAvatar(url);
                              playVoteSound();
                          }}
                          className={`cursor-pointer rounded-full overflow-hidden border-2 transition-all ${selectedAvatar === url ? 'border-amber-500 scale-110 shadow-lg shadow-amber-500/20' : 'border-slate-600 opacity-70 hover:opacity-100'}`}
                       >
                          <img src={url} alt="Avatar Option" className="w-full h-full object-cover" />
                       </div>
                    ))}
                 </div>
              </div>
            </div>

            <Button 
              onClick={handleStartGame} 
              disabled={!setupName}
              className="w-full py-3 text-lg"
              isNight={true}
            >
              開始遊戲
            </Button>

             <div className="text-center">
                <Button variant="ghost" onClick={() => setShowHelp(true)} isNight={true} className="text-sm">
                   <BookOpen size={14} className="mr-2 inline" /> 查看所有角色說明
                </Button>
             </div>
          </div>
        </div>

        {/* Setup Phase Help Modal */}
         <Modal 
            isOpen={showHelp} 
            onClose={() => setShowHelp(false)} 
            title="遊戲角色指南"
            isNight={true}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-700/20">
                {(Object.values(Role) as Role[]).map(r => (
                  <button 
                    key={r}
                    onClick={() => setViewingHelpRole(r)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      viewingHelpRole === r 
                      ? 'bg-amber-500 text-white shadow-md' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {ROLE_DETAILS[r].name}
                  </button>
                ))}
              </div>
               {/* Content */}
               <div className={`flex items-center gap-4 p-4 rounded-xl border bg-slate-800/50 border-slate-700`}>
                  <div className="text-4xl">{ROLE_DETAILS[viewingHelpRole].icon}</div>
                  <div>
                      <div className="font-bold text-lg text-slate-200">{ROLE_DETAILS[viewingHelpRole].name}</div>
                      <div className={`text-xs ${ROLE_DETAILS[viewingHelpRole].team === 'GOOD' ? 'text-blue-500' : 'text-red-500'}`}>
                        {ROLE_DETAILS[viewingHelpRole].team === 'GOOD' ? '好人陣營' : '狼人陣營'}
                      </div>
                      <p className="text-sm mt-1 text-slate-400">{ROLE_DETAILS[viewingHelpRole].description}</p>
                  </div>
              </div>
              <div className="space-y-6">
                <section>
                   <h3 className="text-amber-500 font-bold mb-2 flex items-center gap-2"><Activity size={18} /> 角色特色</h3>
                   <ul className="list-disc list-inside space-y-1 text-sm text-slate-300">
                     {ROLE_GUIDES[viewingHelpRole].features.map((f, i) => <li key={i}>{f}</li>)}
                   </ul>
                </section>
                 <section>
                   <h3 className="text-blue-500 font-bold mb-2 flex items-center gap-2"><Users size={18} /> 玩法策略</h3>
                   <ul className="list-disc list-inside space-y-1 text-sm text-slate-300">
                     {ROLE_GUIDES[viewingHelpRole].gameplay.map((g, i) => <li key={i}>{g}</li>)}
                   </ul>
                </section>
                <section className="p-3 rounded border bg-slate-700/30 border-slate-700">
                   <h3 className="text-red-500 font-bold mb-2 text-sm">注意事項</h3>
                   <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
                     {ROLE_GUIDES[viewingHelpRole].notes.map((n, i) => <li key={i}>{n}</li>)}
                   </ul>
                </section>
              </div>
            </div>
          </Modal>
      </div>
    );
  }

  const currentGuide = ROLE_GUIDES[viewingHelpRole];
  const currentRoleDetail = ROLE_DETAILS[viewingHelpRole];

  return (
    <div className={`min-h-screen flex flex-col md:flex-row overflow-hidden transition-colors duration-1000 ease-in-out ${isNight ? 'bg-slate-900 text-slate-200' : 'bg-slate-100 text-slate-900'}`}>
      {/* --- Left Panel: Game Area --- */}
      <div className="flex-1 flex flex-col relative h-[60vh] md:h-screen p-4">
        
        {/* Top Bar */}
        <div className={`flex justify-between items-center mb-4 p-4 rounded-xl backdrop-blur-sm z-10 transition-colors duration-500 ${isNight ? 'bg-slate-800/50' : 'bg-white/50 shadow-sm'}`}>
          <div className="flex items-center gap-3">
             {isNight ? <Moon className="text-indigo-400" /> : <Sun className="text-amber-500" />}
             <div className="flex flex-col">
               <span className="font-bold text-lg">第 {state.dayCount} {isNight ? '夜' : '天'}</span>
               <span className={`text-xs ${isNight ? 'text-slate-400' : 'text-slate-500'}`}>
                  {state.phase === GamePhase.NIGHT_WEREWOLF && "狼人行動"}
                  {state.phase === GamePhase.NIGHT_SEER && "預言家行動"}
                  {state.phase === GamePhase.NIGHT_WITCH && "女巫行動"}
                  {state.phase === GamePhase.DAY_DISCUSS && "自由討論"}
                  {state.phase === GamePhase.DAY_VOTE && "投票"}
                  {state.phase.includes('GAME_OVER') && "遊戲結束"}
               </span>
             </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowHelp(true)} isNight={isNight}>
               <BookOpen size={16} className="mr-2 inline" /> 玩法說明
            </Button>
            <Button variant="secondary" onClick={() => dispatch({ type: 'RESET_GAME' })} isNight={isNight}>
              <RotateCcw size={16} className="mr-2 inline" /> 重置
            </Button>
          </div>
        </div>

        {/* Players Grid */}
        <div className="flex-1 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3 overflow-y-auto content-center p-2">
          {state.players.map(player => (
            <PlayerCard 
              key={player.id}
              player={player}
              showRole={
                player.id === state.humanPlayerId || 
                state.phase === GamePhase.GAME_OVER || 
                !player.isAlive ||
                // NEW LOGIC: Werewolves can see other werewolves
                (human?.role === Role.WEREWOLF && player.role === Role.WEREWOLF)
              } 
              isSelected={selectedTargetId === player.id}
              isNight={isNight}
              onClick={() => {
                if (isHumanTurn && player.isAlive && player.id !== human?.id) {
                   setSelectedTargetId(player.id);
                   playVoteSound();
                }
              }}
              status={player.voteTargetId && state.phase === GamePhase.DAY_EXECUTE ? "Voted" : undefined}
            />
          ))}
        </div>

        {/* Action Bar (Floating) */}
        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl backdrop-blur-md p-4 rounded-2xl border shadow-2xl flex flex-col items-center gap-3 z-20 transition-colors duration-500 ${isNight ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200'}`}>
          
          {/* Info Text */}
          <div className={`text-center text-sm mb-1 ${isNight ? 'text-slate-300' : 'text-slate-600'}`}>
            {state.phase.includes('NIGHT') && !isHumanTurn && "等待其他玩家行動..."}
            {isHumanTurn && !selectedTargetId && "請選擇一名目標玩家"}
            {isHumanTurn && selectedTargetId && `已選擇: ${state.players.find(p=>p.id===selectedTargetId)?.name}`}
            {!human?.isAlive && "你已死亡，請觀戰。"}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            {isHumanTurn && (
              <>
                <Button 
                  onClick={handleHumanAction} 
                  disabled={!selectedTargetId}
                  variant="danger"
                  isNight={isNight}
                >
                  確認行動
                </Button>

                {state.phase === GamePhase.NIGHT_WITCH && (
                  <>
                     {state.lastKilledId && (
                       <Button 
                         onClick={handleWitchSave} 
                         disabled={!state.witchPotions.save}
                         variant="primary"
                         isNight={isNight}
                       >
                         <Activity size={16} className="mr-1 inline"/> 使用解藥
                       </Button>
                     )}
                     <Button 
                        onClick={handleWitchPoison}
                        disabled={!selectedTargetId || !state.witchPotions.poison}
                        variant="danger"
                        isNight={isNight}
                      >
                         使用毒藥
                      </Button>
                  </>
                )}
              </>
            )}
            
            {state.phase === GamePhase.DAY_DISCUSS && (
               <Button onClick={skipPhase} className="bg-blue-600 hover:bg-blue-500 text-white" isNight={isNight}>
                  發起投票
               </Button>
            )}

            {(state.phase === GamePhase.NIGHT_WITCH && isHumanTurn) && (
               <Button onClick={skipPhase} variant="ghost" isNight={isNight}>不做任何事</Button>
            )}
          </div>
        </div>

      </div>

      {/* --- Right Panel: Logs & Chat --- */}
      <div className={`w-full md:w-96 border-l flex flex-col h-[40vh] md:h-screen transition-colors duration-500 ${isNight ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
         <div className={`p-4 border-b font-serif font-bold text-amber-500 flex items-center gap-2 transition-colors duration-500 ${isNight ? 'border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
           <Users size={18} />
           遊戲記錄
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-2">
           {state.logs.map(log => (
             <LogEntry key={log.id} sender={log.sender} text={log.text} type={log.type} isNight={isNight} />
           ))}
           <div ref={logsEndRef} />
         </div>

         {/* Chat Input for Discussion Phase */}
         {state.phase === GamePhase.DAY_DISCUSS && human?.isAlive && (
            <div className={`p-3 border-t transition-colors duration-500 ${isNight ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex gap-2">
                <input 
                  ref={chatInputRef}
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="輸入對話內容..."
                  className={`flex-1 border rounded px-3 py-2 text-sm focus:border-amber-500 focus:outline-none transition-colors duration-500 ${isNight ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                  disabled={isSendingChat}
                />
                <button 
                  onClick={handleSendChat} 
                  disabled={isSendingChat || !chatMessage.trim()}
                  className="bg-amber-600 p-2 rounded text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
         )}

         {/* Only Human role info at bottom */}
         {human && (
           <div className={`p-4 border-t transition-colors duration-500 ${isNight ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-3">
                 <span className="text-2xl">{ROLE_DETAILS[human.role].icon}</span>
                 <div>
                   <div className="font-bold text-amber-500">{ROLE_DETAILS[human.role].name}</div>
                   <div className="text-xs text-slate-500">{ROLE_DETAILS[human.role].team === 'GOOD' ? '好人陣營' : '狼人陣營'}</div>
                 </div>
              </div>
              <p className={`text-xs mt-2 leading-relaxed ${isNight ? 'text-slate-400' : 'text-slate-600'}`}>
                {ROLE_DETAILS[human.role].description}
              </p>
           </div>
         )}
      </div>

      {/* --- Help Modal --- */}
      <Modal 
        isOpen={showHelp} 
        onClose={() => setShowHelp(false)} 
        title="角色玩法指南"
        isNight={isNight}
      >
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-700/20">
            {(Object.values(Role) as Role[]).map(r => (
              <button 
                key={r}
                onClick={() => setViewingHelpRole(r)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  viewingHelpRole === r 
                  ? 'bg-amber-500 text-white shadow-md' 
                  : (isNight ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300')
                }`}
              >
                {ROLE_DETAILS[r].name}
              </button>
            ))}
          </div>

          {/* Role Header Info */}
          <div className={`flex items-center gap-4 p-4 rounded-xl border ${isNight ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-4xl">{currentRoleDetail.icon}</div>
              <div>
                  <div className={`font-bold text-lg ${isNight ? 'text-slate-200' : 'text-slate-800'}`}>
                    {currentRoleDetail.name}
                  </div>
                  <div className={`text-xs ${currentRoleDetail.team === 'GOOD' ? 'text-blue-500' : 'text-red-500'}`}>
                    {currentRoleDetail.team === 'GOOD' ? '好人陣營' : '狼人陣營'}
                  </div>
                  <p className={`text-sm mt-1 ${isNight ? 'text-slate-400' : 'text-slate-600'}`}>
                    {currentRoleDetail.description}
                  </p>
              </div>
          </div>

          {/* Guides */}
          <div className="space-y-6">
            <section>
               <h3 className="text-amber-500 font-bold mb-2 flex items-center gap-2">
                 <Activity size={18} /> 角色特色
               </h3>
               <ul className={`list-disc list-inside space-y-1 text-sm ${isNight ? 'text-slate-300' : 'text-slate-700'}`}>
                 {currentGuide.features.map((f, i) => <li key={i}>{f}</li>)}
               </ul>
            </section>

            <section>
               <h3 className="text-blue-500 font-bold mb-2 flex items-center gap-2">
                 <Users size={18} /> 玩法策略
               </h3>
               <ul className={`list-disc list-inside space-y-1 text-sm ${isNight ? 'text-slate-300' : 'text-slate-700'}`}>
                 {currentGuide.gameplay.map((g, i) => <li key={i}>{g}</li>)}
               </ul>
            </section>

            <section className={`p-3 rounded border ${isNight ? 'bg-slate-700/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               <h3 className="text-red-500 font-bold mb-2 text-sm">注意事項</h3>
               <ul className={`list-disc list-inside space-y-1 text-xs ${isNight ? 'text-slate-400' : 'text-slate-600'}`}>
                 {currentGuide.notes.map((n, i) => <li key={i}>{n}</li>)}
               </ul>
            </section>
          </div>
        </div>
      </Modal>

      {/* --- Game Over Result Modal --- */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={state.winner === 'WEREWOLF' ? '遊戲結束 - 狼人勝利！' : '遊戲結束 - 好人勝利！'}
        isNight={isNight}
      >
         <div className="space-y-4">
            <div className="text-center mb-4">
               {state.winner === 'WEREWOLF' 
                  ? <div className="text-red-500 flex flex-col items-center"><Trophy size={48} className="mb-2"/> <p>狼人屠殺了整個村莊...</p></div> 
                  : <div className="text-amber-500 flex flex-col items-center"><Trophy size={48} className="mb-2"/> <p>村民成功放逐了所有狼人！</p></div>
               }
            </div>
            
            <div className={`rounded-xl overflow-hidden border ${isNight ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
               <div className={`p-3 border-b font-bold text-sm ${isNight ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'}`}>
                  玩家身份揭曉
               </div>
               <div className="max-h-[40vh] overflow-y-auto p-2 grid grid-cols-1 gap-2 custom-scrollbar">
                 {state.players.map(p => (
                    <div key={p.id} className={`flex items-center justify-between p-2 rounded-lg border ${isNight ? 'bg-slate-800 border-slate-700/50' : 'bg-white border-slate-200'}`}>
                       <div className="flex items-center gap-3">
                         <img src={p.avatarUrl} className={`w-10 h-10 rounded-full object-cover border ${p.isAlive ? (isNight ? 'border-slate-500' : 'border-slate-300') : 'border-red-900 grayscale'}`} alt={p.name} />
                         <div className="flex flex-col">
                            <span className={`font-bold text-sm ${p.id === state.humanPlayerId ? 'text-amber-500' : (isNight ? 'text-slate-200' : 'text-slate-800')}`}>
                               {p.name} {p.id === state.humanPlayerId && "(你)"}
                            </span>
                            <span className="text-xs text-slate-500">{!p.isAlive && "已死亡"}</span>
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className="text-lg">{ROLE_DETAILS[p.role].icon}</span>
                          <span className={`text-sm font-bold ${ROLE_DETAILS[p.role].team === 'BAD' ? 'text-red-500' : 'text-blue-500'}`}>
                             {ROLE_DETAILS[p.role].name}
                          </span>
                       </div>
                    </div>
                 ))}
               </div>
            </div>

            <div className="text-center pt-2">
               <Button onClick={() => dispatch({ type: 'RESET_GAME' })} isNight={isNight}>
                  <RefreshCw size={18} className="mr-2 inline" /> 再玩一局
               </Button>
            </div>
         </div>
      </Modal>

    </div>
  );
};

export default App;

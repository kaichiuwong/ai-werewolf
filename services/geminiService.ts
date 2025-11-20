
import { GoogleGenAI } from "@google/genai";
import { GamePhase, Player, Role, LogMessage } from "../types";
import { ROLE_DETAILS } from "../constants";

// Initialize Gemini
const modelId = 'gemini-2.5-flash';

const getAlivePlayersNames = (players: Player[]) => 
  players.filter(p => p.isAlive).map(p => p.name).join(', ');

export const generateHostNarration = async (
  phase: GamePhase,
  dayCount: number,
  players: Player[],
  deadNames: string[] = []
): Promise<string> => {
  if (!process.env.API_KEY) {
    return getDefaultNarration(phase, dayCount, deadNames);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let prompt = "";
    // const roleInfo = players.map(p => `${p.name}(${p.isAlive ? '生存' : '死亡'})`).join(', ');

    switch (phase) {
      case GamePhase.NIGHT_START:
        prompt = `現在是第 ${dayCount} 夜。天黑請閉眼。請用懸疑恐怖的語氣，用繁體中文簡短描述夜幕降臨的氛圍 (50字以內)。`;
        break;
      case GamePhase.DAY_ANNOUNCE:
        if (deadNames.length === 0) {
          prompt = `現在是第 ${dayCount} 天早上。昨晚是一個平安夜，沒有人死亡。請用繁體中文簡短描述村民慶幸的心情 (50字以內)。`;
        } else {
          prompt = `現在是第 ${dayCount} 天早上。昨晚 ${deadNames.join(', ')} 慘死。請用繁體中文簡短描述發現屍體的恐怖場景 (50字以內)。`;
        }
        break;
      case GamePhase.GAME_OVER:
        const winner = players.find(p => p.role === Role.WEREWOLF && p.isAlive) ? "狼人" : "村民";
        prompt = `遊戲結束，${winner} 勝利。請用繁體中文做一個戲劇性的總結 (50字以內)。`;
        break;
      default:
        return "";
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || getDefaultNarration(phase, dayCount, deadNames);

  } catch (error) {
    console.error("Gemini API Error:", error);
    return getDefaultNarration(phase, dayCount, deadNames);
  }
};

export const generateBotDiscussion = async (
  players: Player[],
  history: LogMessage[]
): Promise<{ speaker: string; content: string } | null> => {
    if (!process.env.API_KEY) return null;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Filter for alive bots
    const aliveBots = players.filter(p => p.isBot && p.isAlive);
    if (aliveBots.length === 0) return null;

    // Pick a random bot to speak
    const speaker = aliveBots[Math.floor(Math.random() * aliveBots.length)];
    const otherPlayers = players.filter(p => p.isAlive && p.id !== speaker.id);
    
    const prompt = `
    你正在扮演一個狼人殺遊戲的玩家。
    你的名字是：${speaker.name}。
    你的身份是：${ROLE_DETAILS[speaker.role].name} (請不要直接暴露身份，除非你是好人且被逼急)。
    場上存活玩家：${otherPlayers.map(p => p.name).join(', ')}。
    目前的對話記錄：
    ${history.slice(-5).map(h => `${h.sender}: ${h.text}`).join('\n')}
    
    請用繁體中文，以你的身份發言。
    如果是狼人，請假裝好人，混淆視聽或嫁禍他人。
    如果是村民/神職，請分析局勢或懷疑某人。
    請只回答一句話 (30字以內)。不要加引號。
    `;

    try {
       const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 0 } // Fast response needed
            }
        });
        return {
            speaker: speaker.name,
            content: response.text || "我覺得有點可疑..."
        };
    } catch (e) {
        return {
            speaker: speaker.name,
            content: "大家安靜一下，我有種不祥的預感。"
        };
    }
};

export const generateBotResponseToUser = async (
  players: Player[],
  history: LogMessage[],
  userMessage: string,
  userName: string
): Promise<{ speaker: string; content: string } | null> => {
    if (!process.env.API_KEY) return null;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Filter for alive bots excluding the user (if user passed in players list, but they are usually bots)
    const aliveBots = players.filter(p => p.isBot && p.isAlive);
    if (aliveBots.length === 0) return null;

    // Pick a random bot to respond
    const speaker = aliveBots[Math.floor(Math.random() * aliveBots.length)];
    
    // Determine if speaker is a teammate (Wolf) with user? 
    // We need to know if User is Wolf. 
    // But to simplify, let's just give the bot its own perspective.
    
    const prompt = `
    你是一個狼人殺遊戲的玩家，名字叫 ${speaker.name}。
    你的身份是：${ROLE_DETAILS[speaker.role].name}。
    
    玩家 ${userName} 剛剛說了一句話："${userMessage}"。
    
    請根據你的身份做出回應：
    1. 如果你是【狼人】：
       - 如果 ${userName} 好像在懷疑你，請反駁或轉移話題。
       - 如果 ${userName} 在懷疑好人，請附和並煽風點火。
       - 請假裝自己是好人。
    2. 如果你是【好人】（村民/神職）：
       - 判斷 ${userName} 的發言是否有道理。
       - 如果覺得合理就表示贊同，覺得奇怪就質疑。
    
    目前的對話記錄供參考：
    ${history.slice(-3).map(h => `${h.sender}: ${h.text}`).join('\n')}

    請用繁體中文，口語化回應 ${userName}。只回應一句話 (30字以內)。
    `;

    try {
       const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return {
            speaker: speaker.name,
            content: response.text || "真的嗎？我再觀察看看。"
        };
    } catch (e) {
        return null;
    }
};

// Fallback narration if API is missing or fails
const getDefaultNarration = (phase: GamePhase, dayCount: number, deadNames: string[]): string => {
  switch (phase) {
    case GamePhase.NIGHT_START:
      return `第 ${dayCount} 夜。天黑請閉眼，狼人請現身...`;
    case GamePhase.DAY_ANNOUNCE:
      return deadNames.length > 0 
        ? `天亮了。昨晚 ${deadNames.join(', ')} 死亡。` 
        : `天亮了。昨晚是平安夜。`;
    case GamePhase.GAME_OVER:
      return "遊戲結束。";
    default:
      return "";
  }
};

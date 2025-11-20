
import React from 'react';
import { Player, Role } from '../types';
import { ROLE_DETAILS } from '../constants';
import { X } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isNight?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className = '', isNight = true, children, ...props }) => {
  const baseStyles = "px-4 py-2 rounded font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";
  
  const variants = {
    primary: "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20",
    secondary: isNight 
      ? "bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600"
      : "bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300",
    danger: "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20",
    ghost: isNight 
      ? "bg-transparent hover:bg-slate-800 text-slate-400"
      : "bg-transparent hover:bg-slate-200 text-slate-600"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

interface PlayerCardProps {
  player: Player;
  showRole: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  status?: string; // e.g. "Voting", "Target"
  isNight: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ player, showRole, onClick, isSelected, status, isNight }) => {
  const nightClasses = !player.isAlive 
    ? 'opacity-50 grayscale bg-slate-900 border-slate-800' 
    : 'bg-slate-800 border-slate-700 hover:border-amber-500/50';
    
  const dayClasses = !player.isAlive
    ? 'opacity-50 grayscale bg-slate-200 border-slate-300'
    : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-amber-500/50';

  const baseClasses = isNight ? nightClasses : dayClasses;
  const textMain = isNight ? 'text-slate-200' : 'text-slate-800';
  const textSub = isNight ? 'text-slate-500' : 'text-slate-400';

  return (
    <div 
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all duration-500
        ${baseClasses}
        ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/50 scale-105' : 'cursor-pointer'}
      `}
    >
      <div className="relative">
        <img 
          src={player.avatarUrl} 
          alt={player.name} 
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 transition-colors duration-500 ${player.isAlive ? (isNight ? 'border-slate-500' : 'border-slate-200') : 'border-red-900'}`}
        />
        {!player.isAlive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
             <span className="text-2xl text-red-500 font-bold">死</span>
          </div>
        )}
        {status && (
            <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full shadow-sm animate-bounce">
                {status}
            </div>
        )}
      </div>
      
      <div className="mt-2 text-center">
        <div className={`font-bold text-sm truncate max-w-[80px] ${textMain}`}>{player.name}</div>
        {showRole && (
          <div className="text-xs text-amber-500 font-bold flex items-center justify-center gap-1">
            <span>{ROLE_DETAILS[player.role].icon}</span>
            <span>{ROLE_DETAILS[player.role].name}</span>
          </div>
        )}
        {!showRole && player.isAlive && (
            <div className={`text-xs ${textSub}`}>???</div>
        )}
      </div>
      
      {/* Indicators for game master debug or specific states */}
      {player.voteTargetId && (
        <div className="absolute top-0 left-0 text-xs bg-slate-700 px-1 rounded text-slate-400 hidden">
          Vote: {player.voteTargetId}
        </div>
      )}
    </div>
  );
};

interface LogEntryProps {
  sender: string;
  text: string;
  type: 'normal' | 'narrative' | 'action' | 'alert';
  isNight: boolean;
}

export const LogEntry: React.FC<LogEntryProps> = ({ sender, text, type, isNight }) => {
  if (type === 'narrative') {
    return (
      <div className={`my-4 p-3 border-l-4 border-amber-500 rounded-r italic transition-colors duration-500 ${isNight ? 'bg-slate-800/50 text-slate-300' : 'bg-amber-50 text-slate-700'}`}>
        <span className="font-bold text-amber-600 block mb-1 text-sm">主持人 (AI)</span>
        {text}
      </div>
    );
  }
  
  if (type === 'alert') {
     return (
      <div className="my-2 text-center text-red-500 font-bold text-sm bg-red-500/10 p-1 rounded border border-red-500/20">
        {text}
      </div>
     );
  }

  return (
    <div className="my-2 text-sm">
      <span className={`font-bold mr-2 ${sender === '系統' ? 'text-blue-500' : (isNight ? 'text-slate-200' : 'text-slate-900')}`}>
        {sender}:
      </span>
      <span className={isNight ? 'text-slate-400' : 'text-slate-600'}>{text}</span>
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isNight: boolean;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, isNight }) => {
  if (!isOpen) return null;

  const bgClass = isNight ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200';
  const textClass = isNight ? 'text-slate-200' : 'text-slate-800';
  const headerBg = isNight ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-100 border-slate-200';
  const footerBg = isNight ? 'bg-slate-900/30 border-slate-700' : 'bg-slate-50 border-slate-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in transition-colors duration-500">
      <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col border transition-colors duration-500 ${bgClass}`}>
        <div className={`p-4 border-b flex justify-between items-center rounded-t-2xl ${headerBg}`}>
          <h2 className="text-xl font-bold text-amber-500 font-serif">{title}</h2>
          <button onClick={onClose} className={`transition-colors ${isNight ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}>
            <X size={24} />
          </button>
        </div>
        <div className={`p-6 overflow-y-auto custom-scrollbar ${textClass}`}>
          {children}
        </div>
        <div className={`p-4 border-t rounded-b-2xl text-right ${footerBg}`}>
          <Button variant="primary" onClick={onClose} isNight={isNight}>關閉</Button>
        </div>
      </div>
    </div>
  );
};

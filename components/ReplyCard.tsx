
import React from 'react';
import { ReplySuggestion } from '../types';

interface ReplyCardProps {
  suggestion: ReplySuggestion;
  onSelect: (text: string) => void;
}

export const ReplyCard: React.FC<ReplyCardProps> = ({ suggestion, onSelect }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group relative">
      <div className="flex flex-col gap-2">
        <p className="text-gray-800 font-medium leading-relaxed">
          "{suggestion.text}"
        </p>
        <p className="text-xs text-gray-500 italic">
          💡 {suggestion.explanation}
        </p>
      </div>
      <button
        onClick={() => onSelect(suggestion.text)}
        className="mt-3 w-full py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
      >
        <span>选用此回复</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </div>
  );
};

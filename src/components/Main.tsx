import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Play, Pause, Trophy, Clock, Target } from 'lucide-react';
import generateWords from 'random-words';

interface TypingStats {
  wpm: number;
  accuracy: number;
  timeElapsed: number;
  correctChars: number;
  totalChars: number;
}

interface WordStatus {
  word: string;
  status: 'pending' | 'correct' | 'incorrect' | 'current';
  userInput?: string;
  charStatuses?: ('correct' | 'incorrect' | 'pending')[];
  hasErrors?: boolean;
}

export const Main: React.FC = () => {
  // Generate words only once when component mounts
  const [words, setWords] = useState<string[]>(() => generateWords({exactly: 40}) as string[]);
  
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>(() =>
    words.map((word: string, index: number) => ({
      word,
      status: index === 0 ? 'current' : 'pending',
      charStatuses: new Array(word.length).fill('pending'),
      hasErrors: false
    }))
  );
  
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [stats, setStats] = useState<TypingStats>({
    wpm: 0,
    accuracy: 100,
    timeElapsed: 0,
    correctChars: 0,
    totalChars: 0
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const calculateStats = useCallback(() => {
    if (!startTime) return;
    
    const timeElapsed = (Date.now() - startTime) / 1000;
    const totalChars = wordStatuses.slice(0, currentWordIndex).reduce((acc, ws) => acc + ws.word.length + 1, 0);
    const correctChars = wordStatuses.slice(0, currentWordIndex).reduce((acc, ws) => {
      return acc + (ws.status === 'correct' ? ws.word.length + 1 : 0);
    }, 0);
    
    const wpm = timeElapsed > 0 ? Math.round((correctChars / 5) / (timeElapsed / 60)) : 0;
    const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;
    
    setStats({
      wpm,
      accuracy,
      timeElapsed: Math.round(timeElapsed),
      correctChars,
      totalChars
    });
  }, [startTime, wordStatuses, currentWordIndex]);

  useEffect(() => {
    if (isGameActive && startTime) {
      intervalRef.current = setInterval(calculateStats, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isGameActive, startTime, calculateStats]);

  // Focus input on component mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const startGame = () => {
    setIsGameActive(true);
    setStartTime(Date.now());
    // Small delay to ensure the input is ready to receive focus
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const pauseGame = () => {
    setIsGameActive(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const resetGame = () => {
    setIsGameActive(false);
    setStartTime(null);
    setCurrentWordIndex(0);
    setCurrentInput('');
    setCurrentCharIndex(0);
    
    // Generate new words for a fresh game
    const newWords = generateWords({exactly: 40}) as string[];
    setWords(newWords);
    setWordStatuses(newWords.map((word, index) => ({
      word,
      status: index === 0 ? 'current' : 'pending',
      charStatuses: new Array(word.length).fill('pending'),
      hasErrors: false
    })));
    
    setStats({
      wpm: 0,
      accuracy: 100,
      timeElapsed: 0,
      correctChars: 0,
      totalChars: 0
    });
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isGameActive) return;
    
    const value = e.target.value;
    setCurrentInput(value);
    
    if (value.endsWith(' ')) {
      // Move to next word
      const newWordStatuses = [...wordStatuses];
      const currentWord = words[currentWordIndex];
      const hasErrors = newWordStatuses[currentWordIndex].hasErrors || value.trim() !== currentWord;
      
      newWordStatuses[currentWordIndex] = {
        ...newWordStatuses[currentWordIndex],
        status: hasErrors ? 'incorrect' : 'correct',
        userInput: value.trim()
      };
      
      if (currentWordIndex < words.length - 1) {
        newWordStatuses[currentWordIndex + 1] = {
          ...newWordStatuses[currentWordIndex + 1],
          status: 'current',
          charStatuses: new Array(words[currentWordIndex + 1].length).fill('pending')
        };
        setCurrentWordIndex(currentWordIndex + 1);
        setCurrentCharIndex(0);
      }
      
      setWordStatuses(newWordStatuses);
      setCurrentInput('');
      
      if (currentWordIndex === words.length - 1) {
        setIsGameActive(false);
      }
    } else {
      // Update character-by-character highlighting
      const currentWord = words[currentWordIndex];
      const newWordStatuses = [...wordStatuses];
      const charStatuses = [...(newWordStatuses[currentWordIndex].charStatuses || [])];
      let hasErrors = newWordStatuses[currentWordIndex].hasErrors || false;
      
      // Update character statuses
      for (let i = 0; i < Math.max(value.length, currentWord.length); i++) {
        if (i < value.length) {
          if (i < currentWord.length) {
            const isCorrect = value[i] === currentWord[i];
            charStatuses[i] = isCorrect ? 'correct' : 'incorrect';
            if (!isCorrect) hasErrors = true;
          }
        } else {
          charStatuses[i] = 'pending';
        }
      }
      
      newWordStatuses[currentWordIndex] = {
        ...newWordStatuses[currentWordIndex],
        charStatuses,
        hasErrors
      };
      
      setWordStatuses(newWordStatuses);
      setCurrentCharIndex(value.length);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Start game on any key press if not active and at beginning
    if (!isGameActive && currentWordIndex === 0) {
      // Don't start on special keys like Tab, Shift, etc.
      if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace') {
        startGame();
        // Don't prevent default for the first keystroke - let it register
        return;
      }
    }
  };

  const progress = (currentWordIndex / words.length) * 100;
  const isGameComplete = currentWordIndex === words.length;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Text Display */}
      <Card className="p-6">
        <div className="text-2xl leading-relaxed font-mono tracking-wide">
          {wordStatuses.map((wordStatus, wordIndex) => (
            <span key={wordIndex} className="mr-2">
              {wordStatus.word.split('').map((char, charIndex) => {
                const isCurrentWord = wordStatus.status === 'current';
                const isCurrentChar = isCurrentWord && charIndex === currentCharIndex;
                const charStatus = wordStatus.charStatuses?.[charIndex] || 'pending';
                
                return (
                  <span
                    key={charIndex}
                    className={`relative transition-all duration-150 ${
                      isCurrentChar
                        ? 'bg-primary text-primary-foreground'
                        : charStatus === 'correct'
                        ? 'text-green-600 dark:text-green-400'
                        : charStatus === 'incorrect'
                        ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30'
                        : wordStatus.status === 'correct'
                        ? 'text-green-600 dark:text-green-400'
                        : wordStatus.status === 'incorrect'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {char}
                    {isCurrentChar && (
                      <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary animate-pulse" />
                    )}
                  </span>
                );
              })}
              {wordIndex < wordStatuses.length - 1 && (
                <span className={`${
                  wordStatus.status === 'current' && currentCharIndex >= wordStatus.word.length
                    ? 'bg-primary text-primary-foreground'
                    : ''
                }`}> </span>
              )}
            </span>
          ))}
        </div>
      </Card>

      {/* Hidden Input Area */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={currentInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isGameComplete}
          className="absolute top-0 left-0 w-full h-full opacity-0 z-10 cursor-default"
          autoFocus
        />
        
        {/* Focus indicator - clickable to focus input */}
        <Card 
          className="p-4 text-center border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => inputRef.current?.focus()}
        >
          <p className="text-sm text-muted-foreground">
            {isGameActive 
              ? "Keep typing..." 
              : isGameComplete
              ? "Game completed! Click Reset to play again"
              : "Start typing any key to begin"
            }
          </p>
        </Card>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">WPM</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.wpm}</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Accuracy</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.accuracy}%</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Time</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{stats.timeElapsed}s</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-sm font-medium text-muted-foreground">Progress</span>
          </div>
          <div className="text-2xl font-bold text-foreground">{Math.round(progress)}%</div>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card className="p-4">
        <Progress value={progress} className="w-full h-2" />
      </Card>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {!isGameActive && currentWordIndex === 0 ? (
          <Button onClick={startGame} size="lg" className="gap-2">
            <Play className="h-4 w-4" />
            Start Game
          </Button>
        ) : isGameActive ? (
          <Button onClick={pauseGame} variant="outline" size="lg" className="gap-2">
            <Pause className="h-4 w-4" />
            Pause
          </Button>
        ) : (
          <Button onClick={startGame} size="lg" className="gap-2">
            <Play className="h-4 w-4" />
            Resume
          </Button>
        )}
        
        <Button onClick={resetGame} variant="outline" size="lg" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {/* Game Complete Message */}
      {isGameComplete && (
        <Card className="p-6 text-center bg-primary/5 border-primary/20">
          <div className="space-y-4">
            <Trophy className="h-12 w-12 text-primary mx-auto" />
            <h3 className="text-2xl font-bold text-foreground">Congratulations!</h3>
            <p className="text-muted-foreground">
              You completed the typing test with {stats.wpm} WPM and {stats.accuracy}% accuracy!
            </p>
            <Button onClick={resetGame} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

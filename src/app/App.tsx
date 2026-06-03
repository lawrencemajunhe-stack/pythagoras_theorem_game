import { useState } from "react";
import { GameHub } from './components/GameHub';
import { Level1Game } from './components/Level1Game';
import { BridgeGame } from './components/BridgeGame';

interface LevelProgress { wrong: number; done: boolean; }
type Screen = 'hub' | 'level1' | 'level2' | 'level3';

export default function App() {
  const [screen, setScreen] = useState<Screen>('hub');
  const [progress, setProgress] = useState<Record<number, LevelProgress>>({});

  const completeLevel = (id: number) => (wrong: number) => {
    setProgress(p => ({ ...p, [id]: { wrong, done: true } }));
  };

  if (screen === 'level1') return <Level1Game onBack={() => setScreen('hub')} onComplete={completeLevel(1)} />;
  if (screen === 'level2') return <BridgeGame levelId={2} onBack={() => setScreen('hub')} onComplete={completeLevel(2)} />;
  if (screen === 'level3') return <BridgeGame levelId={3} onBack={() => setScreen('hub')} onComplete={completeLevel(3)} />;

  return (
    <div className="size-full">
      <GameHub
        progress={progress}
        onSelectLevel={n => setScreen(`level${n}` as Screen)}
      />
    </div>
  );
}

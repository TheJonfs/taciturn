import { BattleView } from './BattleView.tsx';

export function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        margin: 0,
        background: '#0e0f12',
        color: '#e7e9ee',
        minHeight: '100vh',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
      }}
    >
      <header
        style={{
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid #1c1e23',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontSize: '0.85rem',
          opacity: 0.85,
        }}
      >
        Taciturn — demo battle
      </header>
      <BattleView />
    </main>
  );
}

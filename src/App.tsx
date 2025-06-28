// App.tsx
import { useState } from 'react';
import { Layout } from 'antd';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import AddTestModal from './components/AddTestModal';

interface TestSession {
  mode: 'taking' | 'reviewing';
  testId: string;
}

const App = () => {
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [session, setSession] = useState<TestSession | null>(null);

  return (
    <Layout style={{ height: '100vh', width: '100vw'  }}>
      <Sidebar
        selectedId={selectedTestId}
        onSelect={(id) => {
          setSelectedTestId(id);
          setSession(null);
        }}
        onAdd={() => setShowAddModal(true)}
      />
      <MainContent
        selectedTestId={selectedTestId}
        session={session}
        setSession={setSession}
        onAddTest={() => setShowAddModal(true)}
      />
      {showAddModal && (
        <AddTestModal
          onClose={() => setShowAddModal(false)}
          onCreated={(id) => {
            setSelectedTestId(id);
            setShowAddModal(false);
            setSession(null);
          }}
        />
      )}
    </Layout>
  );
};

export default App;


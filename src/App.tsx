import { useEffect, useState } from 'react';
import { Layout, message } from 'antd';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import AddTestModal from './components/AddTestModal';
import { setMessageApi } from './utils/messageProvider';

interface TestSession {
    mode: 'taking' | 'reviewing';
    testId: string;
    timeLimit?: number;
}

const App = () => {
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [session, setSession] = useState<TestSession | null>(null);
    const [messageApi, contextHolder] = message.useMessage();

    useEffect(() => {
        setMessageApi(messageApi);
    }, [messageApi]);

    return (
        <>
            {contextHolder}
            <Layout style={{ display: 'flex', height: '100vh', width: '99vw' }}>
                {session?.mode !== 'taking' && (
                    <Sidebar
                        selectedId={selectedTestId}
                        onSelect={(id) => {
                            setSelectedTestId(id);
                            setSession(null);
                        }}
                        onAdd={() => setShowAddModal(true)}
                    />
                )}
                <div style={{ flex: 1, minWidth: 0, overflow: 'auto', height: '100%' }}>
                    <MainContent
                        selectedTestId={selectedTestId}
                        setSelectedTestId={setSelectedTestId}
                        session={session}
                        setSession={setSession}
                        onAddTest={() => setShowAddModal(true)}
                    />
                </div>
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
        </>
    );
};

export default App;


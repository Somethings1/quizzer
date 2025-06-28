import { useEffect } from 'react';
import { Layout, Menu, Typography, Button, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { db, StoredTest } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

const { Title } = Typography;

interface Props {
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAdd: () => void;
}

const Sidebar: React.FC<Props> = ({ selectedId, onSelect, onAdd }) => {
    const tests = useLiveQuery(() => db.tests.orderBy('createdAt').reverse().toArray(), []) ?? [];

    const handleDeleteAll = async () => {
        await db.tests.clear();
        message.success('All tests deleted');
    };

    return (
        <Layout.Sider width={250} style={{ minWidth: '250px', maxWidth: '250px', background: '#fff' }}>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                }}
            >
                {/* Logo */}
                <div
                    style={{
                        padding: '16px 0',
                        textAlign: 'center',
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: "#000",
                        borderBottom: '1px solid #eee',
                    }}
                >
                    Quizzer
                </div>

                {/* Scrollable menu */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <Menu
                        mode="inline"
                        selectedKeys={selectedId ? [selectedId] : []}
                        style={{ borderRight: 0 }}
                    >
                        <Menu.Item key="add" icon={<PlusOutlined />} onClick={onAdd}>
                            Add New Test
                        </Menu.Item>

                        {tests.map((test) => {
                            const latest = test.attempts[test.attempts.length - 1];
                            return (
                                <Menu.Item key={test.id} onClick={() => onSelect(test.id)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                        <span
                                            style={{
                                                maxWidth: 150,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {test.name}
                                        </span>
                                        <span>{latest ? `${latest.score}/${test.questions.length}` : 'NT'}</span>
                                    </div>
                                </Menu.Item>
                            );
                        })}
                    </Menu>
                </div>

                {/* Delete button pinned to bottom */}
                <div style={{ padding: 16, borderTop: '1px solid #eee' }}>
                    <Button
                        block
                        danger
                        onClick={async () => {
                            await db.tests.clear();
                            message.success('All tests deleted.');
                        }}
                    >
                        Delete All Tests
                    </Button>
                </div>
            </div>
        </Layout.Sider>

    );
};

export default Sidebar;


import { useEffect, useRef, useState } from 'react';
import {
    Layout,
    Menu,
    Typography,
    Button,
    Dropdown,
    Input,
    MenuProps,
    Checkbox,
    Popconfirm,
} from 'antd';
import { db, StoredTest } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { getMessageApi } from '../utils/messageProvider';
import JSZip from 'jszip';

const { Title } = Typography;

interface Props {
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onAdd: () => void;
}

// NEW: Helper function to save files with a user prompt
const saveFile = async (blob: Blob, suggestedName: string, types: { description: string; accept: { [mimeType: string]: string[] } }[]) => {
    const message = getMessageApi();
    // Modern API: show a save file dialog
    if ('showSaveFilePicker' in window) {
        try {
            // @ts-ignore
            const handle = await window.showSaveFilePicker({ suggestedName, types });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
        } catch (err) {
            // AbortError is expected when the user cancels the dialog.
            if ((err as DOMException).name !== 'AbortError') {
                console.error(err);
                message.error('Could not save file.');
            }
            // If user cancels, we don't want to proceed to the fallback.
            return;
        }
    }

    // Fallback for older browsers
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const Sidebar: React.FC<Props> = ({ selectedId, onSelect, onAdd }) => {
    const tests = useLiveQuery(() => db.tests.orderBy('createdAt').reverse().toArray(), []) ?? [];

    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; test: StoredTest; } | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameText, setRenameText] = useState('');
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // NEW: State and ref for select mode context menu and bulk delete
    const [selectContextMenu, setSelectContextMenu] = useState<{ x: number; y: number; } | null>(null);
    const bulkDeleteButtonRef = useRef<HTMLElement>(null);
    const message = getMessageApi();

    const containerRef = useRef<HTMLDivElement>(null);

    const handleCopyJson = async (test: StoredTest) => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(test.questions, null, 2));
            message.success('Copied questions JSON to clipboard');
        } catch (err) {
            console.error(err);
            message.error('Failed to copy questions JSON');
        }
    };

    // CHANGED: Uses the new saveFile helper
    const handleDownloadJson = async (test: StoredTest) => {
        try {
            const blob = new Blob([JSON.stringify(test.questions, null, 2)], { type: 'application/json' });
            await saveFile(
                blob,
                `${test.name || 'test'}.json`,
                [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
            );
        } catch (err) {
            console.error(err);
            message.error('Failed to download questions JSON');
        }
    };

    // NEW: Function to handle downloading multiple selected tests as a zip
    const handleBulkDownload = async () => {
        if (selectedIds.length === 0) return;

        try {
            message.loading({ content: 'Creating zip file...', key: 'zip' });
            const zip = new JSZip();
            const selectedTests = tests.filter(test => selectedIds.includes(test.id));

            for (const test of selectedTests) {
                const jsonContent = JSON.stringify(test.questions, null, 2);
                // Sanitize filename to be filesystem-friendly
                const filename = `${test.name.replace(/[^a-z0-9._-]/gi, '_') || 'test'}.json`;
                zip.file(filename, jsonContent);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            message.destroy('zip');

            await saveFile(
                zipBlob,
                'quizzer_tests.zip',
                [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }]
            );

        } catch (err) {
            message.destroy('zip');
            console.error(err);
            message.error('Failed to create or download zip file.');
        }
    };

    // CHANGED: Handles both context menus
    const handleRightClick = (e: React.MouseEvent, test: StoredTest | null) => {
        e.preventDefault();
        // Close any open menus first
        setContextMenu(null);
        setSelectContextMenu(null);

        if (selectMode) {
            // In select mode, menu actions apply to all selected items
            setSelectContextMenu({ x: e.clientX, y: e.clientY });
        } else if (test) {
            // In normal mode, menu actions apply to the specific test
            setContextMenu({ x: e.clientX, y: e.clientY, test });
        }
    };

    useEffect(() => {
        const handleClick = () => {
            setContextMenu(null);
            setSelectContextMenu(null); // Also close the select mode menu
        };
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleToggleSelection = (id: string) => {
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    };

    const handleSelectAll = () => {
        if (selectedIds.length === tests.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(tests.map((t) => t.id));
        }
    };

    const contextMenuItems: MenuProps['items'] = contextMenu ? [
            { key: 'select', label: 'Select', onClick: () => { setSelectMode(true); setSelectedIds([contextMenu.test.id]); setContextMenu(null); }},
            { key: 'copy', label: 'Copy JSON', onClick: () => handleCopyJson(contextMenu.test) },
            { key: 'download', label: 'Download JSON', onClick: () => handleDownloadJson(contextMenu.test) },
            { key: 'rename', label: 'Rename', onClick: () => { setRenamingId(contextMenu.test.id); setRenameText(contextMenu.test.name); setContextMenu(null); }},
            { key: 'delete', label: 'Delete', danger: true, onClick: () => { db.tests.delete(contextMenu.test.id).then(() => { message.success('Deleted test'); if (selectedId === contextMenu.test.id) { onSelect(null); }}); }},
        ] : [];

    // NEW: Menu items for select mode
    const selectContextMenuItems: MenuProps['items'] = selectContextMenu ? [
        { key: 'download_multiple', label: `Download ${selectedIds.length} JSON`, disabled: selectedIds.length === 0, onClick: handleBulkDownload },
        { key: 'delete_multiple', label: `Delete (${selectedIds.length})`, danger: true, disabled: selectedIds.length === 0, onClick: () => { bulkDeleteButtonRef.current?.click(); }},
    ] : [];

    return (
        <Layout.Sider width={250} style={{ background: '#fff' }}>
            <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '26px 0 10px 0', fontSize: 20, fontWeight: 'bold', color: '#000', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    Quizzer
                </div>
                <div style={{ padding: '8px 12px' }}>
                    {selectMode ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <Checkbox indeterminate={ selectedIds.length > 0 && selectedIds.length < tests.length } checked={selectedIds.length === tests.length && tests.length > 0} onChange={handleSelectAll} />
                            <Button size="middle" block onClick={() => { setSelectMode(false); setSelectedIds([]); }}> Cancel </Button>
                            <Popconfirm
                                title={`Delete ${selectedIds.length} test(s)?`}
                                description="This action cannot be undone."
                                okText="Delete"
                                okType="danger"
                                cancelText="Cancel"
                                onConfirm={async () => {
                                    await db.tests.bulkDelete(selectedIds);
                                    message.success(`Deleted ${selectedIds.length} tests`);
                                    if (selectedIds.includes(selectedId || '')) { onSelect(null); }
                                    setSelectMode(false);
                                    setSelectedIds([]);
                                }}
                            >
                                <Button ref={bulkDeleteButtonRef} danger block disabled={selectedIds.length === 0}> Delete </Button>
                            </Popconfirm>
                        </div>
                    ) : (
                        <Button type="link" block onClick={onAdd}> + New Test </Button>
                    )}
                </div>

                {/* CHANGED: Added onContextMenu to this div to catch right-clicks in the list area */}
                <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }} onContextMenu={(e) => handleRightClick(e, null)}>
                    <Menu mode="inline" selectedKeys={selectedId ? [selectedId] : []} style={{ borderRight: 0 }}>
                        {tests.map((test) => {
                            const latest = test.attempts[test.attempts.length - 1];
                            const isSelected = selectedIds.includes(test.id);
                            return (
                                <Menu.Item
                                    key={test.id}
                                    onClick={() => selectMode ? handleToggleSelection(test.id) : onSelect(test.id)}
                                    // CHANGED: handleRightClick now gets the specific test, stopPropagation prevents the parent div's handler from firing
                                    onContextMenu={(e) => { e.stopPropagation(); handleRightClick(e, test); }}
                                    style={{ backgroundColor: isSelected ? '#e6f7ff' : undefined }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {selectMode && ( <Checkbox checked={isSelected} style={{ pointerEvents: 'none' }} /> )}
                                            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {renamingId === test.id ? (
                                                    <Input size="small" autoFocus value={renameText} onChange={(e) => setRenameText(e.target.value)} onBlur={async () => { const trimmed = renameText.trim(); if (trimmed && trimmed !== test.name) { await db.tests.update(test.id, { name: trimmed }); message.success('Renamed'); } setRenamingId(null); }} onPressEnter={(e) => e.currentTarget.blur()} disabled={selectMode} />
                                                ) : ( test.name )}
                                            </span>
                                        </div>
                                        <span>{latest ? `${latest.score}/${test.questions.length}` : 'NT'}</span>
                                    </div>
                                </Menu.Item>
                            );
                        })}
                    </Menu>

                    {contextMenu && (
                        <Dropdown open menu={{ items: contextMenuItems }} trigger={['contextMenu']} placement="bottomLeft">
                            <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, width: 0, height: 0, zIndex: 9999, }} />
                        </Dropdown>
                    )}

                    {/* NEW: Dropdown for the select mode context menu */}
                    {selectContextMenu && (
                        <Dropdown open menu={{ items: selectContextMenuItems }} trigger={['contextMenu']} placement="bottomLeft">
                            <div style={{ position: 'fixed', top: selectContextMenu.y, left: selectContextMenu.x, width: 0, height: 0, zIndex: 9999, }} />
                        </Dropdown>
                    )}
                </div>
            </div>
        </Layout.Sider>
    );
};

export default Sidebar;

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import 'antd/dist/reset.css';
import { ConfigProvider, theme } from 'antd';


createRoot(document.getElementById('root')!).render(
    <ConfigProvider
    >
        <StrictMode>
            <App />
        </StrictMode>,
    </ConfigProvider>
)

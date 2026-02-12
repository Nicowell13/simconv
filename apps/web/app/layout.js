import './globals.css';

export const metadata = {
    title: 'Conversation Sim',
    description: 'Simulasi percakapan 15 nomor peer-to-peer',
};

export default function RootLayout({ children }) {
    return (
        <html lang="id">
            <body>{children}</body>
        </html>
    );
}

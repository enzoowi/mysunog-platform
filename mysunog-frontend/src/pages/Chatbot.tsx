import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { Send, Bot, FileText, ClipboardList, Flame, Droplets, ShieldQuestion, Clock } from 'lucide-react';

type Message = {
    sender: 'user' | 'bot';
    text: string;
};

const QUICK_PROMPTS = [
    { label: 'Report Emergency', message: 'How do I report a fire emergency in Malvar?', icon: <Flame className="w-3 h-3 mr-1" /> },
    { label: 'Emergency Hotlines', message: 'What are the emergency hotlines in Malvar?', icon: <FileText className="w-3 h-3 mr-1" /> },
    { label: 'Fire tips', message: 'What are some fire prevention tips for homes?', icon: <ShieldQuestion className="w-3 h-3 mr-1" /> },
    { label: 'LPG safety', message: 'How do I handle LPG safely at home?', icon: <Droplets className="w-3 h-3 mr-1" /> },
    { label: 'Evacuation Routes', message: 'Where can I find emergency evacuation routes?', icon: <ClipboardList className="w-3 h-3 mr-1" /> },
    { label: 'Business Hours', message: 'What are the business hours of the BFP Malvar station?', icon: <Clock className="w-3 h-3 mr-1" /> },
];

export default function Chatbot() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            sender: 'bot',
            text: 'Hello! I\'m the mySunog assistant for BFP Malvar.\n\nTry one of the quick prompts below or type your own question!',
        },
    ]);
    const [loading, setLoading] = useState(false);
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function sendMessage(text?: string) {
        const userMessage = (text || input).trim();
        if (!userMessage) return;

        setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
        setInput('');
        setLoading(true);

        try {
            const res = await api.post('/chatbot/chat', { message: userMessage });
            setMessages((prev) => [...prev, { sender: 'bot', text: res.data.answer }]);
        } catch (error) {
            console.error(error);
            setMessages((prev) => [
                ...prev,
                { sender: 'bot', text: 'Sorry, I could not connect to the assistant right now.' },
            ]);
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') sendMessage();
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-3 border-b bg-gray-50 flex items-center gap-2">
                <Bot className="w-5 h-5 text-orange-600" />
                <div>
                    <h2 className="text-sm font-bold text-gray-800 leading-tight">mySunog Assistant</h2>
                    <p className="text-gray-500 text-[10px] leading-tight">Powered by AI</p>
                </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 p-3 overflow-y-auto bg-gray-50" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                {messages.map((msg, index) => (
                    <div key={index} className={`flex mb-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.sender === 'user'
                            ? 'bg-orange-600 text-white rounded-br-md'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                            }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start mb-3">
                        <div className="bg-white border border-gray-200 text-gray-500 px-4 py-3 rounded-2xl rounded-bl-md text-sm">
                            <em>Typing...</em>
                        </div>
                    </div>
                )}
                <div ref={endOfMessagesRef} />
            </div>

            <div className="p-3 border-t bg-white">
                {/* Quick prompts */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {QUICK_PROMPTS.map((prompt) => (
                        <button key={prompt.label} onClick={() => sendMessage(prompt.message)} disabled={loading}
                            className="flex items-center px-2 py-1 bg-white border border-gray-200 rounded-full text-[10px] text-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition disabled:opacity-50">
                            {prompt.icon} {prompt.label}
                        </button>
                    ))}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown} placeholder="Type your question..."
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    <button onClick={() => sendMessage()} disabled={loading}
                        className="bg-orange-600 text-white p-2 rounded-lg hover:bg-orange-700 transition disabled:opacity-50 flex items-center justify-center">
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
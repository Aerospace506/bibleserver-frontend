import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';

const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ro', label: 'Romanian' },
  { value: 'la', label: 'Latin' },
  { value: 'sr', label: 'Serbian' },
  { value: 'de', label:  'German'}
];

const SUPPORTED_TRANSLATIONS = [
    { value: 'kjv', label: 'King James Version' },
    { value: 'bbe', label: 'Basic English Bible' },
    { value: 'web', label: 'World English Bible' },
    { value: 'almeida', label: 'Portuguese Almeida' },
    { value: 'asv', label: 'American Standard' },
    { value: 'darby', label: 'Darby Bible' },
    { value: 'ylt', label: "Young's Literal" }
  ];

const AudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [verses, setVerses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [translation, setTranslation] = useState('kjv');
    const [language, setLanguage] = useState('en');
    const websocket = useRef(null);
    const audioContext = useRef(null);
    const processor = useRef(null);
    const stream = useRef(null);

    const convertAudioBufferTo16BitPCM = (buffer) => {
        const channels = buffer.numberOfChannels;
        const length = buffer.getChannelData(0).length;
        const bytes = new Uint8Array(length * 2);
        const view = new DataView(bytes.buffer);
        
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < channels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            }
        }
        return bytes;
    };

    const startRecording = async () => {
        setLoading(true);
        try {

            websocket.current = new WebSocket(import.meta.env.VITE_WS_URL);
            
            websocket.current.onopen = () => {
                websocket.current.send(JSON.stringify({
                    translation,
                    language
                }));
            };

            websocket.current.onmessage = (event) => {
                try {
                    const results = JSON.parse(event.data);
                    if (Array.isArray(results)) {
                        setVerses(prev => {
                            const newVerses = results.filter(r => 
                                r.type === 'verse' && 
                                r.text && 
                                !prev.some(v => v.reference === r.reference)
                            );
                            return [...prev, ...newVerses];
                        });
                    }
                } catch (e) {
                    console.error("Invalid message:", event.data);
                }
            };

            stream.current = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            audioContext.current = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.current.createMediaStreamSource(stream.current);
            
            processor.current = audioContext.current.createScriptProcessor(4096, 1, 1);
            source.connect(processor.current);
            processor.current.connect(audioContext.current.destination);

            processor.current.onaudioprocess = (event) => {
                if (websocket.current?.readyState === WebSocket.OPEN) {
                    const pcmData = convertAudioBufferTo16BitPCM(event.inputBuffer);
                    websocket.current.send(pcmData);
                }
            };

            setIsRecording(true);
        } catch (error) {
            console.error('Recording error:', error);
        }
        setLoading(false);
    };

    const stopRecording = async () => {
        setLoading(true);
        if (processor.current) {
            processor.current.onaudioprocess = null;
            processor.current.disconnect();
            processor.current = null;
        }
        if (stream.current) {
            stream.current.getTracks().forEach(track => track.stop());
        }
        if (websocket.current) {
            websocket.current.close();
        }
        if (audioContext.current) {
            await audioContext.current.close();
        }
        setIsRecording(false);
        setLoading(false);
    };

    useEffect(() => {
        return () => {
            if (isRecording) stopRecording();
        };
    }, []);

    useEffect(() => {
        if (!isRecording) {
            setVerses([]);
        }
    }, [translation, language]);

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                    Bible Reference Finder
                </h1>

                <div className="sticky top-4 bg-white z-10 pb-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Bible Translation
                            </label>
                            <select
                                value={translation}
                                onChange={(e) => setTranslation(e.target.value)}
                                className="w-full p-2 border rounded-md bg-white text-gray-900"
                                disabled={isRecording}
                            >
                                {SUPPORTED_TRANSLATIONS.map(({ value, label }) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Spoken Language
                            </label>
                            <select
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                                className="w-full p-2 border rounded-md bg-white text-gray-900"
                                disabled={isRecording}
                            >
                                {SUPPORTED_LANGUAGES.map(({ value, label }) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center transition-colors ${
                            isRecording 
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                        disabled={loading}
                    >
                        {isRecording ? (
                            <>
                                <StopIcon className="w-5 h-5 mr-2" />
                                Stop Recording
                            </>
                        ) : (
                            <>
                                <MicrophoneIcon className="w-5 h-5 mr-2" />
                                {loading ? 'Starting...' : 'Start Recording'}
                            </>
                        )}
                    </button>
                </div>

                <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {verses.map((verse, index) => (
                        <div key={`${verse.reference}-${index}`} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                                <p className="font-semibold text-blue-600">
                                    {verse.reference}
                                </p>
                                <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                    {verse.translation.toUpperCase()}
                                </span>
                                <span className={`text-sm px-2 py-1 rounded ${
                                    verse.source === 'direct' 
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-purple-100 text-purple-800'
                                }`}>
                                    {verse.source.toUpperCase()}
                                </span>
                            </div>
                            <blockquote className="text-gray-700 italic">
                                "{verse.text}"
                            </blockquote>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AudioRecorder;
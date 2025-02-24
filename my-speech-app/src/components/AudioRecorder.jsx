import React, { useState, useRef, useEffect } from 'react';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';

const AudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [verses, setVerses] = useState([]);
    const [loading, setLoading] = useState(false);
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
            setVerses([]); // Reset verses on new recording
            
            websocket.current.onmessage = (event) => {
                try {
                    const results = JSON.parse(event.data);
                    if (Array.isArray(results)) {
                        setVerses(prev => {
                            const existingRefs = new Set(prev.map(v => v.reference.toLowerCase()));
                            const newVerses = results.filter(r => 
                                r.type === 'verse' && 
                                r.text && 
                                !existingRefs.has(r.reference.toLowerCase())
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
                if (!websocket.current || websocket.current.readyState !== WebSocket.OPEN) return;
                const pcmData = convertAudioBufferTo16BitPCM(event.inputBuffer);
                websocket.current.send(pcmData);
            };

            setIsRecording(true);
            setLoading(false);

        } catch (error) {
            console.error('Recording error:', error);
            setLoading(false);
        }
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
        if (websocket.current?.readyState === WebSocket.OPEN) {
            websocket.current.close();
        }
        if (audioContext.current) {
            await audioContext.current.close();
        }
        setIsRecording(false);
        setLoading(false);
    };

    useEffect(() => () => stopRecording(), []);

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                    Scripture Finder
                </h1>

                <div className="sticky top-4 bg-white z-10 pb-4">
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

                    {loading && !isRecording && (
                        <div className="mt-4 text-center text-gray-500">
                            Initializing audio...
                        </div>
                    )}
                </div>

                <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {verses.map((verse, index) => (
                        <div key={`${verse.reference}-${index}`} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-baseline gap-2 mb-2">
                                <p className="font-semibold text-blue-600">
                                    {verse.reference}
                                </p>
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
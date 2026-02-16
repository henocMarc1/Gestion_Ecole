'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Mail, Send, ChevronLeft } from 'lucide-react';

interface Conversation {
  userId: string;
  fullName: string;
  role: string;
  lastMessage: string;
  lastMessageAt: string;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  school_id: string;
  subject?: string;
  body: string;
  status: 'DRAFT' | 'SENT' | 'ARCHIVED' | 'DELETED';
  created_at: string;
  updated_at: string;
  read_at?: string;
}

export default function TeacherMessagesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(false);

  // Real-time subscriptions
  useRealtimeSubscription({
    table: 'messages',
    event: '*',
    onData: () => {
      if (selectedConversation) {
        loadMessages(selectedConversation);
      } else {
        loadConversations();
      }
    },
    enabled: true,
  });

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        setCurrentUser(data);
      }
    };
    getCurrentUser();
  }, []);

  // Load conversations
  const loadConversations = async () => {
    try {
      if (!currentUser) return;

      const { data } = await supabase
        .from('messages')
        .select('sender_id, recipient_id, body, created_at')
        .or(`sender_id.eq.${currentUser.id}, recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (!data) return;

      // Get unique conversation partners
      const partners = new Map<string, Conversation>();
      
      for (const msg of data) {
        const partnerId = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
        
        if (!partners.has(partnerId)) {
          // Fetch partner details
          const { data: partnerData } = await supabase
            .from('users')
            .select('id, full_name, role')
            .eq('id', partnerId)
            .single();

          if (partnerData) {
            partners.set(partnerId, {
              userId: partnerId,
              fullName: partnerData.full_name,
              role: partnerData.role,
              lastMessage: msg.body,
              lastMessageAt: msg.created_at,
            });
          }
        }
      }

      setConversations(Array.from(partners.values()));
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (partnerId: string) => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${currentUser.id}, recipient_id.eq.${partnerId}), and(sender_id.eq.${partnerId}, recipient_id.eq.${currentUser.id})`
        )
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(data as Message[]);

        // Mark messages as read
        await supabase
          .from('messages')
          .update({ status: 'SENT', read_at: new Date().toISOString() })
          .eq('sender_id', partnerId)
          .eq('recipient_id', currentUser.id);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setIsSending(true);
    try {
      await supabase.from('messages').insert({
        school_id: currentUser.school_id,
        sender_id: currentUser.id,
        recipient_id: selectedConversation,
        body: newMessage,
        subject: 'Message Direct',
        status: 'SENT',
        metadata: { type: 'direct_message' },
      });

      setNewMessage('');
      await loadMessages(selectedConversation);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Initialize
  useEffect(() => {
    if (currentUser) {
      loadConversations();
    }
  }, [currentUser]);

  // Select conversation
  const handleSelectConversation = (userId: string) => {
    setSelectedConversation(userId);
    loadMessages(userId);
    setShowMobileThread(true);
  };

  const handleBackToConversations = () => {
    setShowMobileThread(false);
    setSelectedConversation(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Mail className="w-12 h-12 text-primary-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Chargement des messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Messagerie</h1>
        <p className="text-gray-600 mt-2">Communiquez directement avec les parents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
        {/* Conversations list */}
        <div className={`lg:col-span-1 ${showMobileThread ? 'hidden lg:block' : ''}`}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <p className="text-gray-500 text-sm">Aucune conversation</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {conversations.map((conv) => (
                    <button
                      key={conv.userId}
                      onClick={() => handleSelectConversation(conv.userId)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedConversation === conv.userId
                          ? 'bg-primary-50 border-l-4 border-primary-600'
                          : 'hover:bg-gray-50 border-l-4 border-transparent'
                      }`}
                    >
                      <p className="font-medium text-gray-900">{conv.fullName}</p>
                      <p className="text-xs text-gray-500 capitalize">{conv.role}</p>
                      <p className="text-sm text-gray-600 truncate mt-1">{conv.lastMessage}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(conv.lastMessageAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Message thread */}
        <div className={`lg:col-span-3 ${showMobileThread ? '' : 'hidden lg:block'}`}>
          <Card className="h-full flex flex-col">
            {selectedConversation ? (
              <>
                {/* Thread header */}
                <CardHeader className="border-b pb-4">
                  <div className="flex items-center gap-2">
                    {showMobileThread && (
                      <button
                        onClick={handleBackToConversations}
                        className="lg:hidden text-gray-600 hover:text-gray-900"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}
                    <div>
                      <CardTitle className="text-lg">
                        {conversations.find((c) => c.userId === selectedConversation)?.fullName}
                      </CardTitle>
                      <p className="text-sm text-gray-500 capitalize">
                        {conversations.find((c) => c.userId === selectedConversation)?.role}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Aucun message pour le moment</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-full sm:max-w-xs px-4 py-2 rounded-lg ${
                            msg.sender_id === currentUser.id
                              ? 'bg-primary-600 text-white rounded-br-none'
                              : 'bg-gray-100 text-gray-900 rounded-bl-none'
                          }`}
                        >
                          <p className="break-words">{msg.body}</p>
                          <p
                            className={`text-xs mt-1 ${
                              msg.sender_id === currentUser.id ? 'text-primary-100' : 'text-gray-500'
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>

                {/* Input form */}
                <div className="border-t p-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Écrivez un message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      disabled={isSending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || isSending}
                      className="bg-primary-600 hover:bg-primary-700 w-full sm:w-auto"
                    >
                      {isSending ? (
                        <span className="animate-spin">⏳</span>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Sélectionnez une conversation pour commencer</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icons } from '@/components/ui/Icons';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { toast } from 'sonner';

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
  sender?: { full_name: string };
  recipient?: { full_name: string };
}

interface Conversation {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export default function ParentMessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages();
    }
  }, [selectedConversation]);

  // Abonnement aux messages en temps réel
  useRealtimeSubscription({
    table: 'messages',
    event: '*',
    onData: () => {
      if (selectedConversation) {
        loadMessages();
      }
    },
    enabled: !!selectedConversation,
  });

  const loadConversations = async () => {
    try {
      if (!user?.id) return;

      // Récupérer les conversations du parent
      const { data, error } = await supabase
        .from('messages')
        .select('sender_id, recipient_id, sender:sender_id(full_name, role), recipient:recipient_id(full_name, role), created_at, body')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Créer une liste de conversations uniques
      const conversationMap = new Map<string, Conversation>();

      (data || []).forEach((msg: any) => {
        const otherUserId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
        const otherUser = msg.sender_id === user.id ? msg.recipient : msg.sender;

        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            id: otherUserId,
            user_id: otherUserId,
            full_name: otherUser.full_name,
            role: otherUser.role,
            last_message: msg.body,
            last_message_at: msg.created_at,
          });
        }
      });

      const convList = Array.from(conversationMap.values());
      setConversations(convList);

      if (convList.length > 0 && !selectedConversation) {
        setSelectedConversation(convList[0].id);
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      if (!selectedConversation || !user?.id) return;

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${selectedConversation}),and(sender_id.eq.${selectedConversation},recipient_id.eq.${user.id})`
        )
        .order('created_at');

      if (error) throw error;

      setMessages(data || []);

      // Marquer comme lus
      if (data && data.length > 0) {
        const unreadMessages = data.filter(m => m.recipient_id === user.id && m.status !== 'SENT');
        if (unreadMessages.length > 0) {
          await supabase
            .from('messages')
            .update({ status: 'SENT', read_at: new Date().toISOString() })
            .in('id', unreadMessages.map(m => m.id));
        }
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement des messages');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedConversation) {
      toast.error('Veuillez écrire un message');
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          school_id: user?.school_id,
          sender_id: user?.id,
          recipient_id: selectedConversation,
          body: newMessage.trim(),
          subject: 'Message Direct',
          status: 'SENT',
          metadata: { type: 'direct_message' },
        }]);

      if (error) throw error;

      setNewMessage('');
      toast.success('Message envoyé');
      loadMessages();
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setIsSending(false);
    }
  };

  const currentConversation = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messagerie</h1>
        <p className="text-gray-600">Communiquez avec les enseignants et l'école</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
        {/* Liste des conversations */}
        <Card className="lg:col-span-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length > 0 ? (
              <div className="divide-y">
                {conversations.map(conversation => (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedConversation === conversation.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                    }`}
                  >
                    <p className="font-medium text-gray-900 truncate">{conversation.full_name}</p>
                    <p className="text-xs text-gray-500 mt-1">{conversation.role}</p>
                    {conversation.last_message && (
                      <p className="text-sm text-gray-600 mt-1 truncate">{conversation.last_message}</p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Icons.Mail className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">Aucune conversation</p>
              </div>
            )}
          </div>
        </Card>

        {/* Zone de messages */}
        {selectedConversation && currentConversation ? (
          <Card className="lg:col-span-2 overflow-hidden flex flex-col">
            {/* En-tête conversation */}
            <div className="p-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">{currentConversation.full_name}</h3>
              <p className="text-sm text-gray-500">{currentConversation.role}</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length > 0 ? (
                messages.map((message, idx) => {
                  const isOwn = message.sender_id === user?.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-full sm:max-w-xs px-4 py-2 rounded-lg ${
                          isOwn
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.body}</p>
                        <p className={`text-xs mt-1 ${isOwn ? 'text-primary-200' : 'text-gray-500'}`}>
                          {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <Icons.MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Aucun message pour le moment</p>
                </div>
              )}
            </div>

            {/* Formulaire d'envoi */}
            <form onSubmit={handleSendMessage} className="p-4 border-t bg-gray-50">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Écrivez votre message..."
                  disabled={isSending}
                />
                <Button
                  type="submit"
                  disabled={isSending || !newMessage.trim()}
                  className="whitespace-nowrap w-full sm:w-auto"
                >
                  {isSending ? (
                    <Icons.Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icons.Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="lg:col-span-2 flex items-center justify-center">
            <div className="text-center">
              <Icons.MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Sélectionnez une conversation pour commencer</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

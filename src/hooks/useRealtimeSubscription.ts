import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface RealtimePayload {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any>;
  old: Record<string, any>;
}

interface UseRealtimeSubscriptionOptions {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onData?: (payload: RealtimePayload) => void;
  onInsert?: (record: any) => void;
  onUpdate?: (record: any) => void;
  onDelete?: (record: any) => void;
  enabled?: boolean;
}

/**
 * Hook pour s'abonner aux changements en temps réel d'une table
 * @param options - Configuration de l'abonnement
 * @returns La fonction pour se désabonner
 */
export function useRealtimeSubscription({
  table,
  event = '*',
  filter,
  onData,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeSubscriptionOptions) {
  // Utiliser useRef pour garder les callbacks stables
  const onDataRef = useRef(onData);
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  // Mettre à jour les refs quand les callbacks changent
  useEffect(() => {
    onDataRef.current = onData;
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;
  }, [onData, onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled) return;

    let channel: RealtimeChannel | null = null;

    const setupSubscription = async () => {
      try {
        channel = supabase.channel(`${table}_changes_${Date.now()}`);

        const subscription = channel
          .on<any>(
            'postgres_changes' as any,
            {
              event,
              schema: 'public',
              table,
              filter,
            } as any,
            (payload: any) => {
              if (onDataRef.current) {
                onDataRef.current(payload as RealtimePayload);
              }
              
              // Handle specific event callbacks
              if (payload.eventType === 'INSERT' && onInsertRef.current) {
                onInsertRef.current(payload.new);
              } else if (payload.eventType === 'UPDATE' && onUpdateRef.current) {
                onUpdateRef.current(payload.new);
              } else if (payload.eventType === 'DELETE' && onDeleteRef.current) {
                onDeleteRef.current(payload.old);
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log(`✓ Connecté aux changements de ${table}`);
            } else if (status === 'CHANNEL_ERROR') {
              console.error(`✗ Erreur connexion ${table}:`, status);
            }
          });

        return subscription;
      } catch (error) {
        console.error(`Erreur lors de l'abonnement à ${table}:`, error);
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [table, event, filter, enabled]);
}

/**
 * Hook pour s'abonner à plusieurs tables
 */
export function useRealtimeSubscriptions(
  subscriptions: UseRealtimeSubscriptionOptions[]
) {
  useEffect(() => {
    const channels: RealtimeChannel[] = [];

    subscriptions.forEach(({ table, event = '*', filter, onData, enabled = true }) => {
      if (!enabled) return;

      const channel = supabase.channel(`${table}_changes_${Math.random()}`);

      channel
        .on<any>(
          'postgres_changes' as any,
          {
            event,
            schema: 'public',
            table,
            filter,
          } as any,
          (payload: any) => {
            if (onData) {
              onData(payload as RealtimePayload);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✓ Connecté aux changements de ${table}`);
          }
        });

      channels.push(channel);
    });

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [subscriptions]);
}

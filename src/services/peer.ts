/**
 * PeerRelay API client.
 *
 * Rooms are scoped to a concept. The store never receives a transcript or a score, and the
 * client never sends one: only what the student chose to share travels with the room.
 */
import { request } from './api';
import type { ContributionKind, PeerRoom, PeerRoomSummary, WeakConcept } from '@/types';

export const listRooms = (subject?: string) =>
  request<{ rooms: PeerRoomSummary[] }>(`/api/peer/rooms${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`).then(
    (r) => r.rooms,
  );

export const getRoom = (id: string) => request<{ room: PeerRoom }>(`/api/peer/rooms/${id}`).then((r) => r.room);

export interface CreateRoomInput {
  title?: string;
  concept: string;
  detail: string;
  question?: string;
  shareLevel: WeakConcept['shareLevel'];
  sharedExcerpt?: string;
  subject?: string;
  ownerLabel?: string;
}

export const createRoom = (input: CreateRoomInput) =>
  request<{ room: PeerRoom }>('/api/peer/rooms', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.room);

export interface AddContributionInput {
  kind: ContributionKind;
  text: string;
  author?: string;
  parentId?: string;
  byOwner?: boolean;
}

export const addContribution = (roomId: string, input: AddContributionInput) =>
  request<{ contribution: PeerRoom['contributions'][number] }>(`/api/peer/rooms/${roomId}/contributions`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((r) => r.contribution);

export const markHelpful = (roomId: string, contributionId: string) =>
  request<{ contribution: PeerRoom['contributions'][number] }>(
    `/api/peer/rooms/${roomId}/contributions/${contributionId}/helpful`,
    { method: 'POST' },
  ).then((r) => r.contribution);

export const saveUnderstanding = (roomId: string, understanding: string) =>
  request<{ room: PeerRoom }>(`/api/peer/rooms/${roomId}/understanding`, {
    method: 'POST',
    body: JSON.stringify({ understanding }),
  }).then((r) => r.room);

export const closeRoom = (roomId: string) =>
  request<{ room: PeerRoom }>(`/api/peer/rooms/${roomId}/close`, { method: 'POST' }).then((r) => r.room);

export const deleteRoom = (roomId: string) =>
  request<{ deleted: boolean }>(`/api/peer/rooms/${roomId}`, { method: 'DELETE' });

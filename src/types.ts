export type Level = 1 | 2; // 1 = if need be, 2 = available

export interface EventInfo {
  id: string;
  title: string;
  description: string | null;
  dates: string[]; // YYYY-MM-DD, in the event time zone
  day_start_min: number;
  day_end_min: number;
  slot_minutes: number;
  timezone: string;
  meeting_url: string | null;
  organizer_name: string | null;
  final_start: string | null;
  final_end: string | null;
}

export interface Participant {
  id: string;
  name: string;
  has_pin: boolean;
}

export interface AvailabilityRow {
  p: string; // participant id
  s: string; // slot start, UTC ISO
  l: Level;
}

export interface EventBundle {
  event: EventInfo;
  participants: Participant[];
  availability: AvailabilityRow[];
}

export interface NewEvent {
  title: string;
  description?: string;
  dates: string[];
  day_start_min: number;
  day_end_min: number;
  slot_minutes: number;
  timezone: string;
  meeting_url?: string;
  organizer_name?: string;
  organizer_email?: string;
  reminder_offsets: number[];
}

export interface SaveInput {
  eventId: string;
  name: string;
  pin: string;
  email: string;
  wantsReminder: boolean;
  slots: { s: string; l: Level }[];
}

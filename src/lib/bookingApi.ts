import type { SupabaseClient } from '@supabase/supabase-js';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

type CreateHoldInput = { serviceId: string; therapistId: string; startTime: string };
type ConfirmHoldInput = { bookingId: string; confirmationToken: string; name: string; contact: string };

type Hold = { bookingId: string; confirmationToken: string; heldUntil: string };
type ConfirmedBooking = { bookingId: string; startTime: string; endTime: string; status: 'confirmed' };

function bookingError(message: string): Error {
  if (message.includes('SLOT_UNAVAILABLE')) return new Error('That appointment is no longer available. Please choose another time.');
  if (message.includes('HOLD_EXPIRED')) return new Error('Your hold has expired. Please choose another time.');
  return new Error('We could not complete the booking. Please try again.');
}

export function createBookingApi(client: RpcClient) {
  return {
    async createHold(input: CreateHoldInput): Promise<Hold> {
      const { data, error } = await client.rpc('create_booking_hold', {
        p_service_id: input.serviceId,
        p_therapist_id: input.therapistId,
        p_start_time: input.startTime,
      });
      if (error || !data?.[0]) throw bookingError(error?.message ?? 'EMPTY_RESPONSE');
      const hold = data[0] as { booking_id: string; confirmation_token: string; held_until: string };
      return { bookingId: hold.booking_id, confirmationToken: hold.confirmation_token, heldUntil: hold.held_until };
    },
    async confirmHold(input: ConfirmHoldInput): Promise<ConfirmedBooking> {
      const { data, error } = await client.rpc('confirm_booking_hold', {
        p_booking_id: input.bookingId,
        p_confirmation_token: input.confirmationToken,
        p_customer_name: input.name,
        p_customer_contact: input.contact,
      });
      if (error || !data?.[0]) throw bookingError(error?.message ?? 'EMPTY_RESPONSE');
      const booking = data[0] as { booking_id: string; start_time: string; end_time: string; status: 'confirmed' };
      return { bookingId: booking.booking_id, startTime: booking.start_time, endTime: booking.end_time, status: booking.status };
    },
  };
}

import { describe, expect, it, vi } from 'vitest';
import { createBookingApi } from './bookingApi';

const rpc = vi.fn();
const api = createBookingApi({ rpc } as never);

describe('booking API', () => {
  it('creates a hold through the database RPC, not a direct table insert', async () => {
    rpc.mockResolvedValueOnce({ data: [{ booking_id: 'hold-1', confirmation_token: 'token-1', held_until: '2026-10-01T09:05:00Z' }], error: null });

    await expect(api.createHold({ serviceId: 'service-1', therapistId: 'therapist-1', startTime: '2026-10-01T09:00:00Z' }))
      .resolves.toEqual({ bookingId: 'hold-1', confirmationToken: 'token-1', heldUntil: '2026-10-01T09:05:00Z' });
    expect(rpc).toHaveBeenCalledWith('create_booking_hold', {
      p_service_id: 'service-1', p_therapist_id: 'therapist-1', p_start_time: '2026-10-01T09:00:00Z',
    });
  });

  it('surfaces a database rejection as a usable booking error', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'SLOT_UNAVAILABLE' } });

    await expect(api.createHold({ serviceId: 'service-1', therapistId: 'therapist-1', startTime: '2026-10-01T09:00:00Z' }))
      .rejects.toThrow('That appointment is no longer available. Please choose another time.');
  });

  it('confirms only with the opaque hold token', async () => {
    rpc.mockResolvedValueOnce({ data: [{ booking_id: 'hold-1', start_time: '2026-10-01T09:00:00Z', end_time: '2026-10-01T10:00:00Z', status: 'confirmed' }], error: null });

    await expect(api.confirmHold({ bookingId: 'hold-1', confirmationToken: 'token-1', name: 'Ama', contact: '0240000000' }))
      .resolves.toMatchObject({ bookingId: 'hold-1', status: 'confirmed' });
  });
});

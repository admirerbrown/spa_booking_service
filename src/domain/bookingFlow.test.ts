import { describe, expect, it } from "vitest";

import {
  bookingFlowReducer,
  initialBookingFlowState,
  type BookingFlowState,
} from "./bookingFlow";

describe("booking flow reducer", () => {
  it("moves from selecting-slot to creating-hold when a slot is selected", () => {
    const state = bookingFlowReducer(initialBookingFlowState, {
      type: "SELECT_SLOT",
      slot: {
        therapistId: "therapist-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
    });

    expect(state).toEqual({
      status: "creating-hold",
      slot: {
        therapistId: "therapist-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
    });
  });

  it("moves from selecting-slot to reconciling when an active hold is restored", () => {
    const state = bookingFlowReducer(initialBookingFlowState, {
      type: "RESTORE_HOLD",
      bookingId: "booking-1",
      confirmationToken: "token-1",
      slot: {
        therapistId: "therapist-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
    });

    expect(state).toEqual({
      status: "reconciling",
      slot: {
        therapistId: "therapist-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
      bookingId: "booking-1",
      confirmationToken: "token-1",
    });
  });

  it("moves from creating-hold to held when the hold succeeds", () => {
    const state = bookingFlowReducer(
      {
        status: "creating-hold",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
      },
      {
        type: "HOLD_CREATED",
        bookingId: "booking-1",
        confirmationToken: "token-1",
        heldUntil: "2026-10-05T09:05:00Z",
      },
    );

    expect(state).toEqual({
      status: "held",
      slot: {
        therapistId: "therapist-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
      bookingId: "booking-1",
      confirmationToken: "token-1",
      heldUntil: "2026-10-05T09:05:00Z",
    });
  });

  it("moves to slot selection when the selected slot is taken", () => {
    const state = bookingFlowReducer(
      {
        status: "creating-hold",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
      },
      {
        type: "HOLD_FAILED",
        code: "SLOT_UNAVAILABLE",
      },
    );

    expect(state).toEqual({
      status: "hold-failed",
      reason: "slot-unavailable",
    });
  });

  it("moves to slot selection when hold creation fails unexpectedly", () => {
    const state = bookingFlowReducer(
      {
        status: "creating-hold",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
      },
      {
        type: "HOLD_FAILED",
        code: "UNKNOWN",
      },
    );

    expect(state).toEqual({
      status: "hold-failed",
      reason: "unknown",
    });
  });

  it("returns to slot selection after acknowledging a hold failure", () => {
    const state = bookingFlowReducer(
      {
        status: "hold-failed",
        reason: "slot-unavailable",
      },
      {
        type: "ACKNOWLEDGE_FAILURE",
      },
    );

    expect(state).toEqual(initialBookingFlowState);
  });

  it("moves from held to confirming when customer details are submitted", () => {
    const state = bookingFlowReducer(
      {
        status: "held",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
        bookingId: "booking-1",
        confirmationToken: "token-1",
        heldUntil: "2026-10-05T09:05:00Z",
      },
      {
        type: "SUBMIT_DETAILS",
        name: "Ama",
        contact: "0240000000",
      },
    );

    expect(state).toEqual({
      status: "confirming",
      slot: {
        therapistId: "therapist-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
      bookingId: "booking-1",
      confirmationToken: "token-1",
      heldUntil: "2026-10-05T09:05:00Z",
      name: "Ama",
      contact: "0240000000",
    });
  });

  it("moves from held to hold-expired when the countdown reaches zero", () => {
    const state = bookingFlowReducer(
      {
        status: "held",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
        bookingId: "booking-1",
        confirmationToken: "token-1",
        heldUntil: "2026-10-05T09:05:00Z",
      },
      {
        type: "HOLD_EXPIRED",
      },
    );

    expect(state).toEqual({
      status: "hold-expired",
    });
  });

  it("returns to slot selection after an expired hold is acknowledged", () => {
    const state = bookingFlowReducer(
      {
        status: "hold-expired",
      },
      {
        type: "ACKNOWLEDGE_EXPIRY",
      },
    );

    expect(state).toEqual(initialBookingFlowState);
  });

  it("moves from confirming to confirmed when confirmation succeeds", () => {
    const state = bookingFlowReducer(
      {
        status: "confirming",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
        bookingId: "booking-1",
        confirmationToken: "token-1",
        heldUntil: "2026-10-05T09:05:00Z",
        name: "Ama",
        contact: "0240000000",
      },
      {
        type: "CONFIRM_SUCCESS",
        bookingId: "booking-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
    );

    expect(state).toEqual({
      status: "confirmed",
      bookingId: "booking-1",
      startTime: "2026-10-05T09:00:00Z",
      endTime: "2026-10-05T10:00:00Z",
    });
  });

  it("moves from confirming to hold-expired when the server reports HOLD_EXPIRED", () => {
    const state = bookingFlowReducer(
      {
        status: "confirming",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
        bookingId: "booking-1",
        confirmationToken: "token-1",
        heldUntil: "2026-10-05T09:05:00Z",
        name: "Ama",
        contact: "0240000000",
      },
      {
        type: "CONFIRM_FAILED",
        code: "HOLD_EXPIRED",
      },
    );

    expect(state).toEqual({
      status: "hold-expired",
    });
  });

  it("moves from confirming to reconciliation when confirmation fails unexpectedly", () => {
    const state = bookingFlowReducer(
      {
        status: "confirming",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
        bookingId: "booking-1",
        confirmationToken: "token-1",
        heldUntil: "2026-10-05T09:05:00Z",
        name: "Ama",
        contact: "0240000000",
      },
      {
        type: "CONFIRM_FAILED",
        code: "UNKNOWN",
      },
    );

    expect(state).toEqual({
      status: "reconciling",
      slot: {
        therapistId: "therapist-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
      bookingId: "booking-1",
      confirmationToken: "token-1",
    });
  });

  it("moves from reconciliation to confirmed when status lookup confirms the booking", () => {
    const state = bookingFlowReducer(
      {
        status: "reconciling",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
        bookingId: "booking-1",
        confirmationToken: "token-1",
      },
      {
        type: "STATUS_CONFIRMED",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
    );

    expect(state).toEqual({
      status: "confirmed",
      bookingId: "booking-1",
      startTime: "2026-10-05T09:00:00Z",
      endTime: "2026-10-05T10:00:00Z",
    });
  });

  it("moves from reconciliation to held when status lookup finds an active hold", () => {
    const state = bookingFlowReducer(
      {
        status: "reconciling",
        slot: {
          therapistId: "therapist-1",
          startTime: "2026-10-05T09:00:00Z",
          endTime: "2026-10-05T10:00:00Z",
        },
        bookingId: "booking-1",
        confirmationToken: "token-1",
      },
      {
        type: "STATUS_HELD",
        heldUntil: "2026-10-05T09:05:00Z",
      },
    );

    expect(state).toEqual({
      status: "held",
      slot: {
        therapistId: "therapist-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
      bookingId: "booking-1",
      confirmationToken: "token-1",
      heldUntil: "2026-10-05T09:05:00Z",
    });
  });
  it("returns to slot selection when persisted hold reconciliation fails", () => {
    const state: BookingFlowState = {
      status: "reconciling",
      slot: {
        therapistId: "therapist-1",
        startTime: "2026-10-05T09:00:00Z",
        endTime: "2026-10-05T10:00:00Z",
      },
      bookingId: "booking-1",
      confirmationToken: "token-1",
    };

    expect(
      bookingFlowReducer(state, {
        type: "ACKNOWLEDGE_EXPIRY",
      }),
    ).toEqual({
      status: "selecting-slot",
    });
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";

type RpcClient = Pick<SupabaseClient, "rpc">;

type CreateHoldInput = {
  serviceId: string;
  therapistId: string;
  startTime: string;
};

type ConfirmHoldInput = {
  bookingId: string;
  confirmationToken: string;
  name: string;
  contact: string;
};

type GetBookingStatusInput = {
  bookingId: string;
  confirmationToken: string;
};

type Hold = {
  bookingId: string;
  confirmationToken: string;
  heldUntil: string;
};

type ConfirmedBooking = {
  bookingId: string;
  startTime: string;
  endTime: string;
  status: "confirmed";
};

type BookingStatus = {
  bookingId: string;
  status: "held" | "confirmed";
  heldUntil: string | null;
  startTime: string;
  endTime: string;
};

export type BookingErrorCode =
  | "SLOT_UNAVAILABLE"
  | "HOLD_EXPIRED"
  | "HOLD_NOT_FOUND"
  | "CUSTOMER_DETAILS_REQUIRED"
  | "SERVICE_NOT_FOUND"
  | "BOOKING_NOT_FOUND"
  | "UNKNOWN";

export class BookingError extends Error {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.name = "BookingError";
    this.code = code;
  }
}

function getBookingErrorCode(message: string): BookingErrorCode {
  if (message.includes("SLOT_UNAVAILABLE")) {
    return "SLOT_UNAVAILABLE";
  }

  if (message.includes("HOLD_EXPIRED")) {
    return "HOLD_EXPIRED";
  }

  if (message.includes("HOLD_NOT_FOUND")) {
    return "HOLD_NOT_FOUND";
  }

  if (message.includes("CUSTOMER_DETAILS_REQUIRED")) {
    return "CUSTOMER_DETAILS_REQUIRED";
  }

  if (message.includes("SERVICE_NOT_FOUND")) {
    return "SERVICE_NOT_FOUND";
  }

  if (message.includes("BOOKING_NOT_FOUND")) {
    return "BOOKING_NOT_FOUND";
  }

  return "UNKNOWN";
}

function bookingError(message: string): BookingError {
  const code = getBookingErrorCode(message);

  switch (code) {
    case "SLOT_UNAVAILABLE":
      return new BookingError(
        code,
        "That appointment is no longer available. Please choose another time.",
      );

    case "HOLD_EXPIRED":
      return new BookingError(
        code,
        "Your hold has expired. Please choose another time.",
      );

    case "HOLD_NOT_FOUND":
      return new BookingError(
        code,
        "Your booking hold could not be found. Please choose another time.",
      );

    case "CUSTOMER_DETAILS_REQUIRED":
      return new BookingError(
        code,
        "Your name and contact details are required.",
      );

    case "SERVICE_NOT_FOUND":
      return new BookingError(code, "The selected service could not be found.");

    case "BOOKING_NOT_FOUND":
      return new BookingError(code, "The booking could not be found.");

    case "UNKNOWN":
      return new BookingError(
        code,
        "We could not complete the booking. Please try again.",
      );
  }
}

export function createBookingApi(client: RpcClient) {
  return {
    async createHold(input: CreateHoldInput): Promise<Hold> {
      const { data, error } = await client.rpc("create_booking_hold", {
        p_service_id: input.serviceId,
        p_therapist_id: input.therapistId,
        p_start_time: input.startTime,
      });

      if (error || !data?.[0]) {
        throw bookingError(error?.message ?? "EMPTY_RESPONSE");
      }

      const hold = data[0] as {
        booking_id: string;
        confirmation_token: string;
        held_until: string;
      };

      return {
        bookingId: hold.booking_id,
        confirmationToken: hold.confirmation_token,
        heldUntil: hold.held_until,
      };
    },

    async confirmHold(input: ConfirmHoldInput): Promise<ConfirmedBooking> {
      const { data, error } = await client.rpc("confirm_booking_hold", {
        p_booking_id: input.bookingId,
        p_confirmation_token: input.confirmationToken,
        p_customer_name: input.name,
        p_customer_contact: input.contact,
      });

      if (error || !data?.[0]) {
        throw bookingError(error?.message ?? "EMPTY_RESPONSE");
      }

      const booking = data[0] as {
        booking_id: string;
        start_time: string;
        end_time: string;
        status: "confirmed";
      };

      return {
        bookingId: booking.booking_id,
        startTime: booking.start_time,
        endTime: booking.end_time,
        status: booking.status,
      };
    },

    async getBookingStatus(
      input: GetBookingStatusInput,
    ): Promise<BookingStatus> {
      const { data, error } = await client.rpc("get_booking_status", {
        p_booking_id: input.bookingId,
        p_confirmation_token: input.confirmationToken,
      });

      if (error || !data?.[0]) {
        throw bookingError(error?.message ?? "EMPTY_RESPONSE");
      }

      const booking = data[0] as {
        booking_id: string;
        status: "held" | "confirmed";
        held_until: string | null;
        start_time: string;
        end_time: string;
      };

      return {
        bookingId: booking.booking_id,
        status: booking.status,
        heldUntil: booking.held_until,
        startTime: booking.start_time,
        endTime: booking.end_time,
      };
    },
  };
}

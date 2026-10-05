export type BookingSlot = {
  therapistId: string;
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

export type BookingFlowState =
  | { status: "selecting-slot" }
  | { status: "creating-hold"; slot: BookingSlot }
  | {
      status: "held";
      slot: BookingSlot;
      bookingId: string;
      confirmationToken: string;
      heldUntil: string;
    }
  | {
      status: "hold-failed";
      reason: "slot-unavailable" | "unknown";
    }
  | { status: "hold-expired" }
  | {
      status: "confirming";
      slot: BookingSlot;
      bookingId: string;
      confirmationToken: string;
      heldUntil: string;
      name: string;
      contact: string;
    }
  | {
      status: "confirmed";
      bookingId: string;
      startTime: string;
      endTime: string;
    }
  | {
      status: "reconciling";
      slot: BookingSlot;
      bookingId: string;
      confirmationToken: string;
    };

export type BookingFlowAction =
  | { type: "SELECT_SLOT"; slot: BookingSlot }
  | {
      type: "RESTORE_HOLD";
      bookingId: string;
      confirmationToken: string;
      slot: BookingSlot;
    }
  | {
      type: "HOLD_CREATED";
      bookingId: string;
      confirmationToken: string;
      heldUntil: string;
    }
  | { type: "HOLD_FAILED"; code: BookingErrorCode }
  | { type: "ACKNOWLEDGE_FAILURE" }
  | { type: "SUBMIT_DETAILS"; name: string; contact: string }
  | { type: "HOLD_EXPIRED" }
  | { type: "ACKNOWLEDGE_EXPIRY" }
  | {
      type: "CONFIRM_SUCCESS";
      bookingId: string;
      startTime: string;
      endTime: string;
    }
  | { type: "CONFIRM_FAILED"; code: BookingErrorCode }
  | {
      type: "STATUS_CONFIRMED";
      startTime: string;
      endTime: string;
    }
  | { type: "STATUS_HELD"; heldUntil: string };

export const initialBookingFlowState: BookingFlowState = {
  status: "selecting-slot",
};

export function bookingFlowReducer(
  state: BookingFlowState,
  action: BookingFlowAction,
): BookingFlowState {
  switch (state.status) {
    case "selecting-slot":
      if (action.type === "SELECT_SLOT") {
        return {
          status: "creating-hold",
          slot: action.slot,
        };
      }

      if (action.type === "RESTORE_HOLD") {
        return {
          status: "reconciling",
          slot: action.slot,
          bookingId: action.bookingId,
          confirmationToken: action.confirmationToken,
        };
      }

      return state;

    case "creating-hold":
      if (action.type === "HOLD_CREATED") {
        return {
          status: "held",
          slot: state.slot,
          bookingId: action.bookingId,
          confirmationToken: action.confirmationToken,
          heldUntil: action.heldUntil,
        };
      }

      if (action.type === "HOLD_FAILED") {
        return {
          status: "hold-failed",
          reason:
            action.code === "SLOT_UNAVAILABLE" ? "slot-unavailable" : "unknown",
        };
      }

      return state;

    case "hold-failed":
      if (action.type === "ACKNOWLEDGE_FAILURE") {
        return initialBookingFlowState;
      }

      return state;

    case "held":
      if (action.type === "SUBMIT_DETAILS") {
        return {
          status: "confirming",
          slot: state.slot,
          bookingId: state.bookingId,
          confirmationToken: state.confirmationToken,
          heldUntil: state.heldUntil,
          name: action.name,
          contact: action.contact,
        };
      }

      if (action.type === "HOLD_EXPIRED") {
        return { status: "hold-expired" };
      }

      return state;

    case "confirming":
      if (action.type === "CONFIRM_SUCCESS") {
        return {
          status: "confirmed",
          bookingId: action.bookingId,
          startTime: action.startTime,
          endTime: action.endTime,
        };
      }

      if (action.type === "CONFIRM_FAILED") {
        if (action.code === "HOLD_EXPIRED") {
          return { status: "hold-expired" };
        }

        return {
          status: "reconciling",
          slot: state.slot,
          bookingId: state.bookingId,
          confirmationToken: state.confirmationToken,
        };
      }

      return state;

    case "hold-expired":
      if (action.type === "ACKNOWLEDGE_EXPIRY") {
        return initialBookingFlowState;
      }

      return state;

    case "reconciling":
      if (action.type === "STATUS_CONFIRMED") {
        return {
          status: "confirmed",
          bookingId: state.bookingId,
          startTime: action.startTime,
          endTime: action.endTime,
        };
      }

      if (action.type === "STATUS_HELD") {
        return {
          status: "held",
          slot: state.slot,
          bookingId: state.bookingId,
          confirmationToken: state.confirmationToken,
          heldUntil: action.heldUntil,
        };
      }

      return state;

    case "confirmed":
      return state;
  }
}

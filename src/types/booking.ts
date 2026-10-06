export type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
};

export type AvailableSlot = {
  therapistId: string;
  startTime: string;
  endTime: string;
};

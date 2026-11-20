"use client";

import { create } from "zustand";

/** UI state shared across the desk screens (which ticket drawer is open, map layer toggles). */
type UIState = {
  drawerTicketNo: string | null;
  openTicket: (ticketNo: string) => void;
  closeTicket: () => void;
};

export const useUI = create<UIState>((set) => ({
  drawerTicketNo: null,
  openTicket: (ticketNo) => set({ drawerTicketNo: ticketNo }),
  closeTicket: () => set({ drawerTicketNo: null }),
}));

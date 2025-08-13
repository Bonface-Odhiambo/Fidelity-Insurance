import { Injectable } from '@angular/core';

export interface SavedQuote {
  id: string;
  status: 'pending' | 'completed';
  date: string;
  planDetails: any;
  travelerDetails: any;
  premiumSummary: any;
}

const QUOTES_STORAGE_KEY = 'fidelity_pending_quotes';

@Injectable({
  providedIn: 'root'
})
export class TravelQuoteService { // Renamed from QuoteService

  constructor() { }

  /**
   * Retrieves all saved quotes from local storage.
   * @returns An array of SavedQuote objects.
   */
  getPendingQuotes(): SavedQuote[] {
    const quotesJson = localStorage.getItem(QUOTES_STORAGE_KEY);
    if (quotesJson) {
      try {
        return JSON.parse(quotesJson) as SavedQuote[];
      } catch (e) {
        console.error('Error parsing quotes from local storage', e);
        return [];
      }
    }
    return [];
  }

  /**
   * Saves a new quote to local storage.
   * @param quote The quote data to save.
   */
  saveQuote(quote: Omit<SavedQuote, 'id' | 'date' | 'status'>): void {
    const allQuotes = this.getPendingQuotes();
    
    const newQuote: SavedQuote = {
      ...quote,
      id: `FID-Q-${Date.now()}`,
      status: 'pending',
      date: new Date().toISOString(),
    };

    allQuotes.push(newQuote);
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(allQuotes));
  }
}
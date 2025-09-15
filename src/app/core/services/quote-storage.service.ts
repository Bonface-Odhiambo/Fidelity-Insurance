import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PersonalAccidentQuote {
  id: string;
  userId?: string;
  timestamp: number;
  formData: any;
  coverOption: string;
  ageRange: string;
  calculatedPremium: number;
  status: 'draft' | 'quoted' | 'paid';
  reference: string;
  paymentInfo?: {
    method: 'stk' | 'paybill' | 'card';
    reference: string;
    mpesaReceipt?: string;
    paidAt: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class QuoteStorageService {
  private readonly STORAGE_KEY = 'fidelity_quotes';
  private _quotes = new BehaviorSubject<PersonalAccidentQuote[]>([]);

  constructor() {
    this.loadQuotes();
  }

  get quotes$(): Observable<PersonalAccidentQuote[]> {
    return this._quotes.asObservable();
  }

  get quotes(): PersonalAccidentQuote[] {
    return this._quotes.value;
  }

  private loadQuotes(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const quotes = JSON.parse(stored);
        this._quotes.next(quotes);
      }
    } catch (error) {
      console.error('Error loading quotes from localStorage:', error);
      this._quotes.next([]);
    }
  }

  private saveQuotes(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._quotes.value));
    } catch (error) {
      console.error('Error saving quotes to localStorage:', error);
    }
  }

  saveQuote(quote: Omit<PersonalAccidentQuote, 'id' | 'timestamp'>): PersonalAccidentQuote {
    const newQuote: PersonalAccidentQuote = {
      ...quote,
      id: this.generateQuoteId(),
      timestamp: Date.now()
    };

    const currentQuotes = this._quotes.value;
    const updatedQuotes = [...currentQuotes, newQuote];
    
    this._quotes.next(updatedQuotes);
    this.saveQuotes();
    
    return newQuote;
  }

  updateQuote(quoteId: string, updates: Partial<PersonalAccidentQuote>): PersonalAccidentQuote | null {
    const currentQuotes = this._quotes.value;
    const quoteIndex = currentQuotes.findIndex(q => q.id === quoteId);
    
    if (quoteIndex === -1) {
      return null;
    }

    const updatedQuote = { ...currentQuotes[quoteIndex], ...updates };
    const updatedQuotes = [...currentQuotes];
    updatedQuotes[quoteIndex] = updatedQuote;
    
    this._quotes.next(updatedQuotes);
    this.saveQuotes();
    
    return updatedQuote;
  }

  getQuoteById(quoteId: string): PersonalAccidentQuote | null {
    return this._quotes.value.find(q => q.id === quoteId) || null;
  }

  getQuotesByUserId(userId: string): PersonalAccidentQuote[] {
    return this._quotes.value.filter(q => q.userId === userId);
  }

  deleteQuote(quoteId: string): boolean {
    const currentQuotes = this._quotes.value;
    const filteredQuotes = currentQuotes.filter(q => q.id !== quoteId);
    
    if (filteredQuotes.length !== currentQuotes.length) {
      this._quotes.next(filteredQuotes);
      this.saveQuotes();
      return true;
    }
    
    return false;
  }

  private generateQuoteId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PA${timestamp.slice(-6)}${random}`;
  }

  // Get pending quotes (not yet paid) for current session
  getPendingQuotes(): PersonalAccidentQuote[] {
    return this._quotes.value.filter(q => q.status === 'quoted');
  }

  // Clear all quotes (useful for testing or user logout)
  clearAllQuotes(): void {
    this._quotes.next([]);
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

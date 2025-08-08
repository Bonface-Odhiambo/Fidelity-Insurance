// src/app/shared/auth.service.ts

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// --- TYPE DEFINITIONS ---
export interface StoredUser {
  username: string;
  type: 'individual' | 'intermediary';
  loginTime: number;
  name: string;
  email: string;
  phoneNumber?: string;
}
export interface ImporterDetails {
    name: string;
    kraPin: string;
}
export interface RegistrationData {
  fullName?: string;
  phoneNumber?: string;
}
export interface StoredCredentials {
  username: string;
  password: string;
  type: 'individual' | 'intermediary';
}
export interface PendingQuote {
  id: string; 
  title: string;
  type: 'marine' | 'travel';
  status: 'pending';
  createdDate: string;
  quoteDetails: any;
  premium: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEYS = {
    USER_DATA: 'geminia_user_data',
    CREDENTIALS: 'geminia_credentials',
    REGISTRATION_DATA: 'geminia_registration_data',
    PENDING_QUOTES: 'geminia_pending_quotes'
  };

  // --- FIX #1: Explicitly type the array ---
  // This tells TypeScript that the 'type' property will always be 'individual' or 'intermediary'.
  private readonly VALID_USERS: Array<{ username: string; password: string; type: 'individual' | 'intermediary'; name: string; email: string; }> = [
    { username: 'individual@geminia.com', password: 'password123', type: 'individual', name: 'Individual User', email: 'individual@geminia.com' },
    { username: 'intermediary@geminia.com', password: 'password456', type: 'intermediary', name: 'Intermediary User', email: 'intermediary@geminia.com' }
  ];

  private currentUserSubject = new BehaviorSubject<StoredUser | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {}

  // --- Authentication methods ---
  login(username: string, password: string): boolean {
    const user = this.VALID_USERS.find(u => 
      u.username.toLowerCase() === username.toLowerCase().trim() && u.password === password
    );
    if (user) {
      // Store user session and credentials
      this.storeUserSession(user);
      this.storeCredentials({ username: user.username, password: user.password, type: user.type });
      return true;
    }
    this.logout();
    return false;
  }

  logout(): void {
    try {
      Object.values(this.STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      sessionStorage.removeItem('isLoggedIn');
      sessionStorage.removeItem('userType');
      this.currentUserSubject.next(null);
    } catch (error) {
      console.error('Failed to clear stored data:', error);
    }
  }

  isLoggedIn(): boolean {
    const userData = this.getStoredUser();
    if (!userData) return false;
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return (Date.now() - userData.loginTime) < twentyFourHours;
  }

  // --- Storage methods ---
  private storeUserSession(user: { username: string; type: 'individual' | 'intermediary'; name: string; email: string; }): void {
    const userData: StoredUser = { ...user, loginTime: Date.now() };
    try {
      localStorage.setItem(this.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      this.currentUserSubject.next(userData);
    } catch (error) {
      console.error('Failed to store user data:', error);
    }
  }

  private storeCredentials(credentials: StoredCredentials): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials));
    } catch (e) {
      console.error('Failed to store credentials', e);
    }
  }

  /**
   * FIX #2: Re-added getStoredCredentials method.
   */
  getStoredCredentials(): StoredCredentials | null {
    try {
      const credentials = localStorage.getItem(this.STORAGE_KEYS.CREDENTIALS);
      return credentials ? JSON.parse(credentials) : null;
    } catch (error) {
      console.error('Failed to retrieve credentials:', error);
      return null;
    }
  }
  
  getStoredUser(): StoredUser | null {
    try {
      const userData = localStorage.getItem(this.STORAGE_KEYS.USER_DATA);
      return userData ? JSON.parse(userData) : null;
    } catch (error) { return null; }
  }

  getCurrentUser(): StoredUser | null {
    return this.currentUserSubject.value;
  }
  
  /**
   * FIX #3: Re-added getUserType method.
   */
  getUserType(): 'individual' | 'intermediary' | null {
    const storedUser = this.getStoredUser();
    return storedUser ? storedUser.type : null;
  }

  // --- Pending Quote Management ---
  getPendingQuotes(): PendingQuote[] {
    try {
      const quotesJson = localStorage.getItem(this.STORAGE_KEYS.PENDING_QUOTES);
      return quotesJson ? JSON.parse(quotesJson) : [];
    } catch (e) { return []; }
  }

  savePendingQuote(quote: PendingQuote): void {
    const quotes = this.getPendingQuotes();
    const existingIndex = quotes.findIndex(q => q.id === quote.id);
    if (existingIndex > -1) {
      quotes[existingIndex] = quote;
    } else {
      quotes.push(quote);
    }
    localStorage.setItem(this.STORAGE_KEYS.PENDING_QUOTES, JSON.stringify(quotes));
  }

  removePendingQuote(quoteId: string): void {
    let quotes = this.getPendingQuotes();
    quotes = quotes.filter(q => q.id !== quoteId);
    localStorage.setItem(this.STORAGE_KEYS.PENDING_QUOTES, JSON.stringify(quotes));
  }

  // --- Registration data methods ---
  storeRegistrationData(formData: any): void {
    const registrationData = { ...formData, registrationTime: Date.now() };
    try {
      localStorage.setItem(this.STORAGE_KEYS.REGISTRATION_DATA, JSON.stringify(registrationData));
    } catch (error) { console.error('Failed to store registration data:', error); }
  }

  getRegistrationData(): any {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.REGISTRATION_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) { return null; }
  }
}
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isAuthenticated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _currentUser = new BehaviorSubject<User | null>(null);
  private _isAuthenticated = new BehaviorSubject<boolean>(false);

  constructor() {
    // Check if user is stored in localStorage on service initialization
    this.checkStoredAuth();
  }

  get currentUser$(): Observable<User | null> {
    return this._currentUser.asObservable();
  }

  get isAuthenticated$(): Observable<boolean> {
    return this._isAuthenticated.asObservable();
  }

  get isAuthenticated(): boolean {
    return this._isAuthenticated.value;
  }

  get currentUser(): User | null {
    return this._currentUser.value;
  }

  private checkStoredAuth(): void {
    const storedUser = localStorage.getItem('fidelity_user');
    const storedToken = localStorage.getItem('fidelity_token');
    
    if (storedUser && storedToken) {
      try {
        const user = JSON.parse(storedUser);
        this._currentUser.next(user);
        this._isAuthenticated.next(true);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        this.logout();
      }
    }
  }

  login(email: string, password: string): Observable<boolean> {
    return new Observable(observer => {
      // Simulate API call
      setTimeout(() => {
        // Mock successful login
        const user: User = {
          id: 'user_' + Date.now(),
          email: email,
          firstName: 'John',
          lastName: 'Doe',
          isAuthenticated: true
        };

        // Store in localStorage
        localStorage.setItem('fidelity_user', JSON.stringify(user));
        localStorage.setItem('fidelity_token', 'mock_token_' + Date.now());

        this._currentUser.next(user);
        this._isAuthenticated.next(true);

        observer.next(true);
        observer.complete();
      }, 1000);
    });
  }

  logout(): void {
    localStorage.removeItem('fidelity_user');
    localStorage.removeItem('fidelity_token');
    this._currentUser.next(null);
    this._isAuthenticated.next(false);
  }

  // Mock method to simulate different auth states for testing
  setMockAuthState(isAuthenticated: boolean): void {
    if (isAuthenticated) {
      const mockUser: User = {
        id: 'mock_user',
        email: 'test@fidelity.com',
        firstName: 'Test',
        lastName: 'User',
        isAuthenticated: true
      };
      localStorage.setItem('fidelity_user', JSON.stringify(mockUser));
      localStorage.setItem('fidelity_token', 'mock_token');
      this._currentUser.next(mockUser);
      this._isAuthenticated.next(true);
    } else {
      this.logout();
    }
  }
}

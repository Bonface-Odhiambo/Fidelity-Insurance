import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private _toasts = new BehaviorSubject<ToastMessage[]>([]);

  get toasts$(): Observable<ToastMessage[]> {
    return this._toasts.asObservable();
  }

  get toasts(): ToastMessage[] {
    return this._toasts.value;
  }

  show(
    type: ToastMessage['type'],
    title: string,
    message: string,
    duration: number = 5000
  ): string {
    const toast: ToastMessage = {
      id: this.generateId(),
      type,
      title,
      message,
      duration,
      timestamp: Date.now()
    };

    const currentToasts = this._toasts.value;
    this._toasts.next([...currentToasts, toast]);

    // Auto-remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast.id);
      }, duration);
    }

    return toast.id;
  }

  success(title: string, message: string, duration?: number): string {
    return this.show('success', title, message, duration);
  }

  error(title: string, message: string, duration?: number): string {
    return this.show('error', title, message, duration);
  }

  warning(title: string, message: string, duration?: number): string {
    return this.show('warning', title, message, duration);
  }

  info(title: string, message: string, duration?: number): string {
    return this.show('info', title, message, duration);
  }

  remove(toastId: string): void {
    const currentToasts = this._toasts.value;
    const filteredToasts = currentToasts.filter(t => t.id !== toastId);
    this._toasts.next(filteredToasts);
  }

  clear(): void {
    this._toasts.next([]);
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

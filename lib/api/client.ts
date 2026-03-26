import { ApiResponse } from "./types";

// Simulated network delay
const MOCK_DELAY = 300;

// API Configuration
const API_CONFIG = {
  //baseUrl: process.env.NEXT_PUBLIC_API_URL || "/api",
  baseUrl: "/api",
  timeout: 10000,
};

// Simulates API delay for realistic behavior
async function simulateDelay(ms: number = MOCK_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generic API client with retry logic
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 3
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      // For now, we simulate the API calls
      // In production, replace with actual fetch
      await simulateDelay();

      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      if (retries > 0) {
        await simulateDelay(1000);
        return this.request<T>(endpoint, options, retries - 1);
      }

      return {
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_CONFIG.baseUrl);

// Helper for mock API responses
export async function mockApiResponse<T>(
  data: T,
  delay: number = MOCK_DELAY
): Promise<ApiResponse<T>> {
  await simulateDelay(delay);
  return { data };
}

export async function mockApiError(
  error: string,
  delay: number = MOCK_DELAY
): Promise<ApiResponse<never>> {
  await simulateDelay(delay);
  return { error };
}

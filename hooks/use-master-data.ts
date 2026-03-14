"use client";

import { useState, useEffect } from "react";

/**
 * Global variables to persist data across client-side navigation.
 * These will be cleared when the page is hard-refreshed.
 */
let couriersCache: any[] | null = null;
let couriersPromise: Promise<any[]> | null = null;

let statusesCache: any[] | null = null;
let statusesPromise: Promise<any[]> | null = null;

const STATUSES_STORAGE_KEY = "washlap_statuses_cache";

/**
 * Hook to manage couriers data.
 * Persists in memory across navigation, but reloads on page refresh.
 */
export function useCouriers() {
  const [data, setData] = useState<any[]>(couriersCache || []);
  const [isLoading, setIsLoading] = useState(!couriersCache);

  useEffect(() => {
    if (couriersCache) {
      setData(couriersCache);
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      // Prevent duplicate concurrent requests
      if (couriersPromise) {
        const result = await couriersPromise;
        setData(result);
        setIsLoading(false);
        return;
      }

      couriersPromise = (async () => {
        try {
          const response = await fetch("/api/couriers");
          const result = await response.json();
          if (response.ok) {
            couriersCache = result.data;
            return result.data;
          }
          return [];
        } catch (error) {
          console.error("Failed to fetch couriers:", error);
          return [];
        }
      })();

      const result = await couriersPromise;
      setData(result);
      setIsLoading(false);
    };

    fetchData();
  }, []);

  return { data, isLoading };
}

/**
 * Hook to manage statuses data.
 * Persists in sessionStorage so it survives refreshes until the session ends.
 */
export function useStatuses() {
  const [data, setData] = useState<any[]>(statusesCache || []);
  const [isLoading, setIsLoading] = useState(!statusesCache);

  useEffect(() => {
    // 1. Check memory cache first
    if (statusesCache) {
      setData(statusesCache);
      setIsLoading(false);
      return;
    }

    // 2. Check sessionStorage for persistence across refreshes
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(STATUSES_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          statusesCache = parsed;
          setData(parsed);
          setIsLoading(false);
          return;
        } catch (e) {
          sessionStorage.removeItem(STATUSES_STORAGE_KEY);
        }
      }
    }

    const fetchData = async () => {
      if (statusesPromise) {
        const result = await statusesPromise;
        setData(result);
        setIsLoading(false);
        return;
      }

      statusesPromise = (async () => {
        try {
          const response = await fetch("/api/statuses");
          const result = await response.json();
          if (response.ok) {
            statusesCache = result.data;
            if (typeof window !== "undefined") {
              sessionStorage.setItem(STATUSES_STORAGE_KEY, JSON.stringify(result.data));
            }
            return result.data;
          }
          return [];
        } catch (error) {
          console.error("Failed to fetch statuses:", error);
          return [];
        }
      })();

      const result = await statusesPromise;
      setData(result);
      setIsLoading(false);
    };

    fetchData();
  }, []);

  return { data, isLoading };
}

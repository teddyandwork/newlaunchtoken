import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { DashboardSummary, ErrorResponse, GetEventsParams, GetTokensParams, HealthStatus, ProviderStatus, RadarSettings, RadarSettingsUpdate, TelegramTestResult, Token, TokenEvent } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server, database, Telegram, and provider health.
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDashboardSummaryUrl: () => string;
/**
 * @summary Get dashboard totals
 */
export declare const getDashboardSummary: (options?: Parameters<typeof customFetch>[1]) => Promise<DashboardSummary>;
export declare const getGetDashboardSummaryQueryKey: () => readonly ["/api/dashboard/summary"];
export declare const getGetDashboardSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardSummary>>>;
export type GetDashboardSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get dashboard totals
 */
export declare function useGetDashboardSummary<TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetProvidersUrl: () => string;
/**
 * @summary List configured discovery providers
 */
export declare const getProviders: (options?: Parameters<typeof customFetch>[1]) => Promise<ProviderStatus[]>;
export declare const getGetProvidersQueryKey: () => readonly ["/api/providers"];
export declare const getGetProvidersQueryOptions: <TData = Awaited<ReturnType<typeof getProviders>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProviders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProviders>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProvidersQueryResult = NonNullable<Awaited<ReturnType<typeof getProviders>>>;
export type GetProvidersQueryError = ErrorType<unknown>;
/**
 * @summary List configured discovery providers
 */
export declare function useGetProviders<TData = Awaited<ReturnType<typeof getProviders>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProviders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetTokensUrl: (params?: GetTokensParams) => string;
/**
 * @summary List discovered tokens
 */
export declare const getTokens: (params?: GetTokensParams, options?: Parameters<typeof customFetch>[1]) => Promise<Token[]>;
export declare const getGetTokensQueryKey: (params?: GetTokensParams) => readonly ["/api/tokens", ...GetTokensParams[]];
export declare const getGetTokensQueryOptions: <TData = Awaited<ReturnType<typeof getTokens>>, TError = ErrorType<unknown>>(params?: GetTokensParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTokens>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTokens>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTokensQueryResult = NonNullable<Awaited<ReturnType<typeof getTokens>>>;
export type GetTokensQueryError = ErrorType<unknown>;
/**
 * @summary List discovered tokens
 */
export declare function useGetTokens<TData = Awaited<ReturnType<typeof getTokens>>, TError = ErrorType<unknown>>(params?: GetTokensParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTokens>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetEventsUrl: (params?: GetEventsParams) => string;
/**
 * @summary List recent discovery and alert events
 */
export declare const getEvents: (params?: GetEventsParams, options?: Parameters<typeof customFetch>[1]) => Promise<TokenEvent[]>;
export declare const getGetEventsQueryKey: (params?: GetEventsParams) => readonly ["/api/events", ...GetEventsParams[]];
export declare const getGetEventsQueryOptions: <TData = Awaited<ReturnType<typeof getEvents>>, TError = ErrorType<unknown>>(params?: GetEventsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getEvents>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetEventsQueryResult = NonNullable<Awaited<ReturnType<typeof getEvents>>>;
export type GetEventsQueryError = ErrorType<unknown>;
/**
 * @summary List recent discovery and alert events
 */
export declare function useGetEvents<TData = Awaited<ReturnType<typeof getEvents>>, TError = ErrorType<unknown>>(params?: GetEventsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetSettingsUrl: () => string;
/**
 * @summary Get radar settings and setup state
 */
export declare const getSettings: (options?: Parameters<typeof customFetch>[1]) => Promise<RadarSettings>;
export declare const getGetSettingsQueryKey: () => readonly ["/api/settings"];
export declare const getGetSettingsQueryOptions: <TData = Awaited<ReturnType<typeof getSettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSettingsQueryResult = NonNullable<Awaited<ReturnType<typeof getSettings>>>;
export type GetSettingsQueryError = ErrorType<unknown>;
/**
 * @summary Get radar settings and setup state
 */
export declare function useGetSettings<TData = Awaited<ReturnType<typeof getSettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateSettingsUrl: () => string;
/**
 * @summary Update radar settings
 */
export declare const updateSettings: (radarSettingsUpdate: RadarSettingsUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<RadarSettings>;
export declare const getUpdateSettingsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError, {
        data: BodyType<RadarSettingsUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError, {
    data: BodyType<RadarSettingsUpdate>;
}, TContext>;
export type UpdateSettingsMutationResult = NonNullable<Awaited<ReturnType<typeof updateSettings>>>;
export type UpdateSettingsMutationBody = BodyType<RadarSettingsUpdate>;
export type UpdateSettingsMutationError = ErrorType<unknown>;
/**
* @summary Update radar settings
*/
export declare const useUpdateSettings: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError, {
        data: BodyType<RadarSettingsUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateSettings>>, TError, {
    data: BodyType<RadarSettingsUpdate>;
}, TContext>;
export declare const getSendTelegramTestUrl: () => string;
/**
 * @summary Send a minimal Telegram connectivity test
 */
export declare const sendTelegramTest: (options?: Parameters<typeof customFetch>[1]) => Promise<TelegramTestResult>;
export declare const getSendTelegramTestMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof sendTelegramTest>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof sendTelegramTest>>, TError, void, TContext>;
export type SendTelegramTestMutationResult = NonNullable<Awaited<ReturnType<typeof sendTelegramTest>>>;
export type SendTelegramTestMutationError = ErrorType<ErrorResponse>;
/**
* @summary Send a minimal Telegram connectivity test
*/
export declare const useSendTelegramTest: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof sendTelegramTest>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof sendTelegramTest>>, TError, void, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map
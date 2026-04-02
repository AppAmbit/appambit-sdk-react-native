import NativeAppambitCms from './NativeAppambitCms';

export class CmsQuery {
    private contentType: string;
    private filters: any[] = [];

    constructor(contentType: string) {
        this.contentType = contentType;
    }

    private addFilter(field: string, operator: string, value: any) {
        this.filters.push({ field, operator, value });
    }

    search(query: string): this {
        this.filters.push({ method: 'search', args: [query] });
        return this;
    }

    equals(field: string, value: string): this {
        this.addFilter(field, '=', value);
        return this;
    }

    notEquals(field: string, value: string): this {
        this.addFilter(field, '!=', value);
        return this;
    }

    contains(field: string, value: string): this {
        this.addFilter(field, 'LIKE', value);
        return this;
    }

    startsWith(field: string, value: string): this {
        this.filters.push({ method: 'startsWith', args: [field, value] });
        return this;
    }

    greaterThan(field: string, value: number): this {
        this.addFilter(field, '>', value);
        return this;
    }

    greaterThanOrEqual(field: string, value: number): this {
        this.addFilter(field, '>=', value);
        return this;
    }

    lessThan(field: string, value: number): this {
        this.addFilter(field, '<', value);
        return this;
    }

    lessThanOrEqual(field: string, value: number): this {
        this.addFilter(field, '<=', value);
        return this;
    }

    inList(field: string, values: string[]): this {
        this.filters.push({ method: 'inList', args: [field, values] });
        return this;
    }

    notInList(field: string, values: string[]): this {
        this.filters.push({ method: 'notInList', args: [field, values] });
        return this;
    }

    orderByAscending(field: string): this {
        this.filters.push({ method: 'orderByAscending', args: [field] });
        return this;
    }

    orderByDescending(field: string): this {
        this.filters.push({ method: 'orderByDescending', args: [field] });
        return this;
    }

    getPage(page: number): this {
        this.filters.push({ method: 'getPage', args: [page] });
        return this;
    }

    getPerPage(perPage: number): this {
        this.filters.push({ method: 'getPerPage', args: [perPage] });
        return this;
    }

    async getList(): Promise<any[]> {
        const hasPagination = this.filters.some(f => f.method === 'getPage' || f.method === 'getPerPage');
        const finalFilters = hasPagination 
            ? this.filters 
            : [...this.filters, { method: 'getPerPage', args: [-1] }];
            
        return NativeAppambitCms.getList(this.contentType, finalFilters);
    }
}

export class Cms {
    content(contentType: string): CmsQuery {
        return new CmsQuery(contentType);
    }

    clearCache(contentType: string): void {
        NativeAppambitCms.clearCache(contentType);
    }

    clearAllCache(): void {
        NativeAppambitCms.clearAllCache();
    }
}

export const AppambitCms = new Cms();

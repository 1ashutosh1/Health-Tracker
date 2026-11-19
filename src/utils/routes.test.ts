import { checkinDetailHref } from './routes';

describe('checkinDetailHref', () => {
  it('builds the URL the detail route (and the deep link) uses, with no "index" segment', () => {
    expect(checkinDetailHref('ck_123')).toBe('/checkin/ck_123');
  });

  it('encodes ids so unusual characters cannot change the path', () => {
    expect(checkinDetailHref('a/b?c')).toBe('/checkin/a%2Fb%3Fc');
  });
});

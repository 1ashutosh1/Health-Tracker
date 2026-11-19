import { Slot } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { checkinDetailHref } from './routes';

const routes = {
  _layout: () => <Slot />,
  'checkin/[id]/index': () => <Text>detail screen</Text>,
};

describe('checkin detail route', () => {
  it('opens the detail screen at the URL checkinDetailHref builds', async () => {
    await renderRouter(routes, { initialUrl: String(checkinDetailHref('ck_1')) });
    expect(await screen.findByText('detail screen')).toBeTruthy();
  });

  it('does not match the "/index" URL the old pathname produced', async () => {
    await renderRouter(routes, { initialUrl: '/checkin/ck_1/index' });
    expect(screen.queryByText('detail screen')).toBeNull();
  });
});

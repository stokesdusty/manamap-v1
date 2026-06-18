import * as Contacts from 'expo-contacts';
import { useMutation } from '@tanstack/react-query';
import { Alert } from 'react-native';

export function useAddContact() {
  return useMutation({
    mutationFn: async (displayName: string) => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Allow Contacts access in Settings to save this player.');
        return;
      }

      const parts = displayName.trim().split(' ');
      const firstName = parts[0] ?? displayName;
      const lastName = parts.slice(1).join(' ') || undefined;

      await Contacts.addContactAsync({
        contactType: Contacts.ContactTypes.Person,
        name: displayName,
        firstName,
        ...(lastName !== undefined ? { lastName } : {}),
        note: 'ManaMap connection',
      });
    },
    onSuccess: (_data, displayName) => {
      Alert.alert('Saved', `${displayName} added to your contacts.`);
    },
  });
}

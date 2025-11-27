import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
} from 'react-native';
import { X, Check, Search } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/design';

interface SearchableMultiSelectProps {
  options: string[];
  selectedItems: string[];
  onSelectionChange: (items: string[]) => void;
  placeholder?: string;
  title?: string;
  visible?: boolean;
  onClose?: () => void;
  hideTrigger?: boolean;
}

export default function SearchableMultiSelect({
  options,
  selectedItems,
  onSelectionChange,
  placeholder = 'Search...',
  title = 'Select Items',
  visible = false,
  onClose,
  hideTrigger = false,
}: SearchableMultiSelectProps) {
  const [isVisible, setIsVisible] = useState(visible);
  const [searchQuery, setSearchQuery] = useState('');
  const [customInput, setCustomInput] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const toggleItem = (item: string) => {
    if (selectedItems.includes(item)) {
      onSelectionChange(selectedItems.filter((i) => i !== item));
    } else {
      onSelectionChange([...selectedItems, item]);
    }
  };

  const removeItem = (item: string) => {
    onSelectionChange(selectedItems.filter((i) => i !== item));
  };

  const addCustomItem = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selectedItems.includes(trimmed)) {
      onSelectionChange([...selectedItems, trimmed]);
      setCustomInput('');
      setSearchQuery('');
    }
  };

  const handleDone = () => {
    setIsVisible(false);
    setSearchQuery('');
    setCustomInput('');
    if (onClose) {
      onClose();
    }
  };

  // Update isVisible when visible prop changes
  React.useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  return (
    <View style={styles.container}>
      {!hideTrigger && (
        <>
          <TouchableOpacity style={styles.trigger} onPress={() => setIsVisible(true)}>
            <View style={styles.triggerContent}>
              {selectedItems.length === 0 ? (
                <Text style={styles.placeholderText}>{placeholder}</Text>
              ) : (
                <View style={styles.selectedItemsContainer}>
                  {selectedItems.slice(0, 2).map((item) => (
                    <View key={item} style={styles.selectedChip}>
                      <Text style={styles.selectedChipText} numberOfLines={1}>
                        {item}
                      </Text>
                    </View>
                  ))}
                  {selectedItems.length > 2 && (
                    <Text style={styles.moreText}>+{selectedItems.length - 2} more</Text>
                  )}
                </View>
              )}
            </View>
            <Search size={20} color={Colors.text.secondary} />
          </TouchableOpacity>

          {selectedItems.length > 0 && (
            <View style={styles.selectedList}>
              {selectedItems.map((item) => (
                <View key={item} style={styles.selectedItem}>
                  <Text style={styles.selectedItemText} numberOfLines={1}>
                    {item}
                  </Text>
                  <TouchableOpacity onPress={() => removeItem(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <X size={16} color={Colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <Modal visible={isVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={handleDone}>
                <Text style={styles.doneButton}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Search size={20} color={Colors.text.secondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search or type custom..."
                placeholderTextColor={Colors.text.secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="words"
              />
              {searchQuery.trim() && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>

            {searchQuery.trim() && !options.some(opt => opt.toLowerCase() === searchQuery.toLowerCase()) && (
              <TouchableOpacity
                style={styles.addCustomButton}
                onPress={() => {
                  const trimmed = searchQuery.trim();
                  if (trimmed && !selectedItems.includes(trimmed)) {
                    onSelectionChange([...selectedItems, trimmed]);
                    setSearchQuery('');
                  }
                }}>
                <Text style={styles.addCustomButtonText}>
                  Add "{searchQuery.trim()}"
                </Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={filteredOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = selectedItems.includes(item);
                return (
                  <TouchableOpacity
                    style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                    onPress={() => toggleItem(item)}>
                    <Text
                      style={[styles.optionText, isSelected && styles.optionTextSelected]}
                      numberOfLines={2}>
                      {item}
                    </Text>
                    {isSelected && <Check size={20} color={Colors.primary} strokeWidth={3} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No results found</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Type above to add a custom item
                  </Text>
                </View>
              }
              contentContainerStyle={styles.optionsList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 56,
  },
  triggerContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  placeholderText: {
    ...Typography.body,
    color: Colors.text.secondary,
  },
  selectedItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  selectedChip: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    maxWidth: 120,
  },
  selectedChipText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '600',
  },
  moreText: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  selectedList: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedItemText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
  },
  doneButton: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    margin: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    ...Typography.body,
    color: Colors.text.primary,
  },
  addCustomButton: {
    backgroundColor: Colors.primary + '15',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    borderStyle: 'dashed',
  },
  addCustomButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  optionsList: {
    paddingHorizontal: Spacing.lg,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionItemSelected: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary,
  },
  optionText: {
    ...Typography.body,
    color: Colors.text.primary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  optionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    ...Typography.body,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  emptyStateSubtext: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});

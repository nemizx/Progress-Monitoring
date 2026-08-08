import { useImperativeHandle } from 'react';

export function useDprPanelRef(ref, { validate, getReviewData, save, isDirty }) {
  useImperativeHandle(
    ref,
    () => ({
      validate: validate || (() => null),
      getReviewData,
      save: save || (async () => {}),
      isDirty: isDirty || (() => false),
    }),
    [validate, getReviewData, save, isDirty]
  );
}

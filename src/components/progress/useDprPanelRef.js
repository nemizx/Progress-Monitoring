import { useImperativeHandle } from 'react';

export function useDprPanelRef(ref, { validate, getReviewData, save }) {
  useImperativeHandle(
    ref,
    () => ({
      validate: validate || (() => null),
      getReviewData,
      save: save || (async () => {}),
    }),
    [validate, getReviewData, save]
  );
}

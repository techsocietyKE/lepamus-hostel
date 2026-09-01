'use client';

import { useActionState } from 'react';
import { updateCategory } from '@/actions/rooms';
import SubmitButton from '@/components/SubmitButton';
import Notice from '@/components/Notice';

const initial = { ok: null, message: null, errors: {} };

export default function CategoryCard({ category, readOnly }) {
  const [state, action] = useActionState(updateCategory, initial);
  const errors = state.errors ?? {};
  const rooms = category._count.rooms;

  return (
    <form action={action}  className="card h-fit space-y-4 p-5">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-3">
        <div>
          <p className="eyebrow">{category.capacity} bed{category.capacity === 1 ? '' : 's'}</p>
          <h2 className="font-cond text-lg font-semibold">{category.name}</h2>
        </div>
        <p className="num text-sm text-ink-faint">
          {rooms} room{rooms === 1 ? '' : 's'}
        </p>
      </div>

      <input type="hidden" name="id" value={category.id} />

      {state.message ? (
        <Notice tone={state.ok ? 'done' : 'error'}>{state.message}</Notice>
      ) : null}

      <div>
        <label className="label" htmlFor={`description-${category.id}`}>Description</label>
        <textarea
          id={`description-${category.id}`}
          name="description"
          rows={3}
          className="field"
          defaultValue={category.description ?? ''}
          disabled={readOnly}
          placeholder="Three beds, a shared desk and a window onto the courtyard."
          aria-invalid={errors.description ? 'true' : undefined}
        />
        {errors.description ? <p className="err">{errors.description}</p>
          : <p className="hint">Shown to visitors. A room with no description of its own falls back to this one.</p>}
      </div>

      <div>
        <label className="label" htmlFor={`images-${category.id}`}>Photographs</label>
        <input
          id={`images-${category.id}`}
          name="images"
          type="file"
          multiple
          accept="image/*"
          className="field"
          disabled={readOnly}
          aria-invalid={errors.images ? 'true' : undefined}
        />
        
        {category.images?.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {category.images.map((img, i) => (
              <img 
                key={i} 
                src={img} 
                alt="Category preview" 
                className="h-16 w-20 rounded-sm object-cover border border-rule" 
              />
            ))}
          </div>
        )}
        
        {errors.images ? <p className="err">{errors.images}</p>
          : <p className="hint">Select up to 12 images. New uploads will replace the current ones.</p>}
      </div>

      <div className="grid grid-cols-2 items-start gap-3">
        <div>
          <label className="label" htmlFor={`maxShownPublicly-${category.id}`}>Show at most</label>
          <input
            id={`maxShownPublicly-${category.id}`}
            name="maxShownPublicly"
            type="number"
            className="field num"
            defaultValue={category.maxShownPublicly}
            min={1}
            max={50}
            disabled={readOnly}
            aria-invalid={errors.maxShownPublicly ? 'true' : undefined}
          />
          {errors.maxShownPublicly ? <p className="err">{errors.maxShownPublicly}</p>
            : <p className="hint">Rooms listed on the availability page. The rest are counted, not listed.</p>}
        </div>
        <div>
          <span className="label">Website</span>
          <label className="flex items-center gap-2 py-2 text-sm">
            <input
              type="checkbox"
              name="isPublic"
              defaultChecked={category.isPublic}
              disabled={readOnly}
              className="size-4"
            />
            Offer this category publicly
          </label>
          <p className="hint">Unticked, it disappears from the website entirely.</p>
        </div>
      </div>

      {readOnly ? (
        <p className="hint border-t border-rule pt-3">
          Only the proprietor can change how a category is presented.
        </p>
      ) : (
        <SubmitButton className="btn btn-primary w-full" pendingLabel="Saving...">
          Save {category.name}
        </SubmitButton>
      )}
    </form>
  );
}
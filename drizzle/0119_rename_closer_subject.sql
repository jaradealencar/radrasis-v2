-- Custom SQL migration file, put your code below! --
UPDATE "training_subjects"
SET "title" = 'Técnicas de Closer'
WHERE "slug" = 'closer' AND "title" = 'Closer';

-- Convert Andrea's (andrea42k@yahoo.com) published 16-week plan into a program template
-- Run this in your Supabase SQL editor
--
-- This script:
-- 1. Finds Andrea's client record via her email
-- 2. Pulls her 16 published weeks (ordered by date_range ascending)
-- 3. Gathers all workouts per week, grouped by day
-- 4. Inserts the result as a program template in the templates table

INSERT INTO templates (name, type, category, data, organization_id)
SELECT
  'Andrea 16-Week Plan' AS name,
  'program' AS type,
  NULL AS category,
  jsonb_build_object(
    'totalWeeks', (
      SELECT COUNT(*)::int
      FROM weeks w2
      INNER JOIN clients c2 ON c2.id = w2.client_id
      INNER JOIN users u2 ON u2.id = c2.user_id
      WHERE u2.email = 'andrea42k@yahoo.com'
        AND w2.status = 'published'
    ),
    'weeks', (
      SELECT jsonb_agg(week_obj ORDER BY week_num)
      FROM (
        SELECT
          row_number() OVER (ORDER BY w.date_range ASC) AS week_num,
          jsonb_build_object(
            'weekNumber', row_number() OVER (ORDER BY w.date_range ASC),
            'label', COALESCE(w.focus, ''),
            'days', COALESCE(
              (
                SELECT jsonb_agg(day_obj ORDER BY day_order)
                FROM (
                  SELECT
                    wo.day AS day_name,
                    CASE wo.day
                      WHEN 'Monday' THEN 1
                      WHEN 'Tuesday' THEN 2
                      WHEN 'Wednesday' THEN 3
                      WHEN 'Thursday' THEN 4
                      WHEN 'Friday' THEN 5
                      WHEN 'Saturday' THEN 6
                      WHEN 'Sunday' THEN 7
                      ELSE 8
                    END AS day_order,
                    jsonb_build_object(
                      'day', wo.day,
                      'workouts', jsonb_agg(
                        jsonb_build_object(
                          'type', wo.type,
                          'trainingType', COALESCE(wo.training_type, ''),
                          'miles', COALESCE(wo.miles::text, ''),
                          'title', COALESCE(wo.title, ''),
                          'description', COALESCE(wo.description, ''),
                          'distanceUnit', COALESCE(wo.distance_unit, 'mi')
                        ) ORDER BY wo.sort_order
                      )
                    ) AS day_obj
                  FROM workouts wo
                  WHERE wo.week_id = w.id
                  GROUP BY wo.day
                ) days_grouped
              ),
              '[]'::jsonb
            )
          ) AS week_obj
        FROM weeks w
        INNER JOIN clients c ON c.id = w.client_id
        INNER JOIN users u ON u.id = c.user_id
        WHERE u.email = 'andrea42k@yahoo.com'
          AND w.status = 'published'
        ORDER BY w.date_range ASC
      ) weeks_numbered
    )
  ) AS data,
  (
    SELECT organization_id
    FROM users
    WHERE role = 'admin'
    LIMIT 1
  ) AS organization_id;

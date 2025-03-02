UPDATE emoji_details
SET color = CASE
    WHEN LOWER(primary_color) LIKE '%red%' OR LOWER(primary_color) LIKE '%crimson%' OR LOWER(primary_color) LIKE '%scarlet%' THEN 'Red'
    WHEN LOWER(primary_color) LIKE '%orange%' OR LOWER(primary_color) LIKE '%amber%' THEN 'Orange'
    WHEN LOWER(primary_color) LIKE '%yellow%' OR LOWER(primary_color) LIKE '%gold%' THEN 'Yellow'
    WHEN LOWER(primary_color) LIKE '%green%' OR LOWER(primary_color) LIKE '%lime%' OR LOWER(primary_color) LIKE '%olive%' THEN 'Green'
    WHEN LOWER(primary_color) LIKE '%blue%' OR LOWER(primary_color) LIKE '%navy%' OR LOWER(primary_color) LIKE '%azure%' OR LOWER(primary_color) LIKE '%teal%' THEN 'Blue'
    WHEN LOWER(primary_color) LIKE '%purple%' OR LOWER(primary_color) LIKE '%violet%' OR LOWER(primary_color) LIKE '%lavender%' OR LOWER(primary_color) LIKE '%magenta%' THEN 'Purple'
    WHEN LOWER(primary_color) LIKE '%black%' THEN 'Black'
    WHEN LOWER(primary_color) LIKE '%pink%' OR LOWER(primary_color) LIKE '%rose%' THEN 'Pink'
    WHEN LOWER(primary_color) LIKE '%brown%' OR LOWER(primary_color) LIKE '%chocolate%' OR LOWER(primary_color) LIKE '%tan%' THEN 'Brown'
    WHEN LOWER(primary_color) LIKE '%cyan%' OR LOWER(primary_color) LIKE '%turquoise%' OR LOWER(primary_color) LIKE '%aqua%' THEN 'Cyan'
    WHEN LOWER(primary_color) LIKE '%metallic%' OR LOWER(primary_color) LIKE '%silver%' OR LOWER(primary_color) LIKE '%gold%' OR LOWER(primary_color) LIKE '%chrome%' THEN 'Metallic'
    WHEN LOWER(primary_color) LIKE '%gray%' OR LOWER(primary_color) LIKE '%grey%' OR LOWER(primary_color) LIKE '%silver%' THEN 'Gray'
    ELSE color
END;

update emoji_details set primary_color=color where color is not null;
update emoji_details set color=primary_color where color is null;
update emoji_details set primary_color = null where color not in ('Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Black', 'Gray', 'Pink', 'Brown', 'Cyan', 'Metallic');
select primary_color, count(*) from emoji_details group by primary_color;

alter table emoji_details drop column color ;


update emoji_details
set primary_color = 
case 
    when primary_color = 'Red' then 'red'
    when primary_color = 'Orange' then 'orange'
    when primary_color = 'Yellow' then 'yellow'
    when primary_color = 'Green' then 'green'
    when primary_color = 'Blue' then 'blue'
    when primary_color = 'Purple' then 'purple'
    when primary_color = 'Black' then 'black'
    when primary_color = 'Gray' then 'gray'
    when primary_color = 'Pink' then 'pink'
    when primary_color = 'Brown' then 'brown'
    when primary_color = 'Cyan' then 'cyan'
    when primary_color = 'Metallic' then 'metallic' 
end;




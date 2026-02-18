import java.util.ArrayList;

/*
 * 1. Adding events
 * 2. Viewing events
 * 3. Marking as complete
 * 4. Removing events
 */

public class ReminderManager{
    ArrayList<Event> arr;
    public ReminderManager(){
        arr = new ArrayList<>();
    }

    public void addEvent(Event e){
        arr.add(e);
        System.out.println("Event added to the list of events!");
    }

    public void viewEvents(){
        if(arr.isEmpty()){
            System.out.println("Hey! there is no event to be listed.");
            return;
        }
        System.out.println("\n--- All Events ---");
        for(int i=0; i<arr.size(); i++){
            System.out.println((i + 1) + ". Title: " + arr.get(i).getTitle());
            System.out.println("   Description: " + arr.get(i).getDescription());
            System.out.println("   Date: " + arr.get(i).getDate());
            System.out.println("   Status: " + (arr.get(i).getEventStatus() ? "Completed" : "Pending"));
            System.out.println();
        }
    }

    public void showCompletedEvents(){
        if(arr.isEmpty()){
            System.out.println("No event in the list");
            return;
        }
        System.out.println("\n--- Completed Events ---");
        boolean hasCompletedEvents = false;
        for(int i=0; i<arr.size(); i++){
            if(arr.get(i).getEventStatus()){
                if(!hasCompletedEvents) hasCompletedEvents = true;
                System.out.println((i + 1) + ". Title: " + arr.get(i).getTitle());
                System.out.println("   Description: " + arr.get(i).getDescription());
                System.out.println();
            }
        }
        if(!hasCompletedEvents){
            System.out.println("No events have been marked as completed yet.");
        }
    }

    public void updateEventStatus(int ind){
        if(ind <= 0 || ind > arr.size() || arr.isEmpty()) {
            System.out.println("Invalid event number. Cannot update status.");
            return;
        }
        arr.get(ind - 1).setEventStatus(true);
        System.out.println("Event marked as completed!");
    }

    public void removeEvent(int ind){
        if(ind <= 0 || ind > arr.size() || arr.isEmpty()){
            System.out.println("Invalid event number. Not able to remove the event.");
        } else {
            arr.remove(ind - 1);
            System.out.println("Event removed successfully!");
        }
    }
}
